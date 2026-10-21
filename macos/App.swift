import AppKit
import WebKit
import Darwin

@MainActor
final class AppDelegate: NSObject, NSApplicationDelegate, NSWindowDelegate, WKNavigationDelegate, WKScriptMessageHandler {
    var window: NSWindow!
    var web: WKWebView!
    var statusItem: NSStatusItem!
    var backend: Process?
    var poller: Timer?
    var readyTimer: Timer?
    var activity: NSObjectProtocol?
    var lockFD: Int32 = -1
    var readyURL: URL!
    var logHandle: FileHandle?
    var pendingSession = false
    var pageTimers: [Int: Timer] = [:]
    var serverURL = URL(string: "http://127.0.0.1:8787")!
    let fileManager = FileManager.default
    var support: URL {
        if let override = ProcessInfo.processInfo.environment["YOGO_DATA_DIR"] {
            return URL(fileURLWithPath: override, isDirectory: true)
        }
        return fileManager.homeDirectoryForCurrentUser.appendingPathComponent("Library/Application Support/YogoDot", isDirectory: true)
    }
    var agentURL: URL {
        fileManager.homeDirectoryForCurrentUser.appendingPathComponent("Library/LaunchAgents/io.github.nwang123.yogodot.plist")
    }

    func applicationDidFinishLaunching(_ notification: Notification) {
        do {
            try fileManager.createDirectory(at: support, withIntermediateDirectories: true)
            lockFD = Darwin.open(support.appendingPathComponent("app.lock").path, O_CREAT | O_RDWR, 0o600)
            guard lockFD >= 0, flock(lockFD, LOCK_EX | LOCK_NB) == 0 else {
                NSWorkspace.shared.runningApplications.first(where: {
                    $0.bundleIdentifier == Bundle.main.bundleIdentifier && $0.processIdentifier != getpid()
                })?.activate(options: [])
                NSApp.terminate(nil)
                return
            }
            makeMenu()
            try startBackend()
            let distributed = DistributedNotificationCenter.default()
            distributed.addObserver(self, selector: #selector(screenLocked), name: .init("com.apple.screenIsLocked"), object: nil)
            distributed.addObserver(self, selector: #selector(screenUnlocked), name: .init("com.apple.screenIsUnlocked"), object: nil)
            let workspace = NSWorkspace.shared.notificationCenter
            workspace.addObserver(self, selector: #selector(screenLocked), name: NSWorkspace.willSleepNotification, object: nil)
            workspace.addObserver(self, selector: #selector(screenUnlocked), name: NSWorkspace.didWakeNotification, object: nil)
            activity = ProcessInfo.processInfo.beginActivity(options: .userInitiatedAllowingIdleSystemSleep, reason: "Keep keyboard lighting and Pomodoro timers active")
        } catch { fail(error.localizedDescription) }
    }

    func makeMenu() {
        statusItem = NSStatusBar.system.statusItem(withLength: NSStatusItem.squareLength)
        statusItem.button?.image = NSImage(systemSymbolName: "keyboard", accessibilityDescription: "YogoDot")
        let menu = NSMenu()
        menu.addItem(withTitle: "打开 YogoDot", action: #selector(showWindow), keyEquivalent: "o").target = self
        menu.addItem(.separator())
        let startup = menu.addItem(withTitle: "登录时启动", action: #selector(toggleStartup(_:)), keyEquivalent: "")
        startup.target = self
        startup.state = fileManager.fileExists(atPath: agentURL.path) ? .on : .off
        menu.addItem(withTitle: "打开设置与日志文件夹", action: #selector(openData), keyEquivalent: "").target = self
        menu.addItem(.separator())
        menu.addItem(withTitle: "退出 YogoDot", action: #selector(quit), keyEquivalent: "q").target = self
        statusItem.menu = menu
    }

    func startBackend() throws {
        readyURL = support.appendingPathComponent("ready-\(getpid()).json")
        let process = Process()
        process.executableURL = Bundle.main.resourceURL!.appendingPathComponent("backend/yogodot-backend")
        process.arguments = ["--ready-file", readyURL.path, "--parent-pid", String(getpid())]
        var environment = ProcessInfo.processInfo.environment
        environment["YOGO_DATA_DIR"] = support.path
        if CommandLine.arguments.contains("--smoke-test") { process.arguments?.append("--no-hardware") }
        process.environment = environment
        let logURL = support.appendingPathComponent("yogo.log")
        if !fileManager.fileExists(atPath: logURL.path) { fileManager.createFile(atPath: logURL.path, contents: nil) }
        logHandle = try FileHandle(forWritingTo: logURL)
        try logHandle?.seekToEnd()
        process.standardOutput = logHandle
        process.standardError = logHandle
        try process.run()
        backend = process
        let deadline = Date().addingTimeInterval(20)
        readyTimer = Timer.scheduledTimer(withTimeInterval: 0.1, repeats: true) { [weak self] timer in
            DispatchQueue.main.async {
                guard let self else { timer.invalidate(); return }
                if let bytes = try? Data(contentsOf: self.readyURL),
                   let json = try? JSONSerialization.jsonObject(with: bytes) as? [String: Int],
                   let port = json["port"] {
                    timer.invalidate()
                    self.serverURL = URL(string: "http://127.0.0.1:\(port)")!
                    self.makeWindow()
                    self.postSession()
                    self.beginPolling()
                } else if !process.isRunning || Date() > deadline {
                    timer.invalidate()
                    self.fail("本地服务未能启动。端口 8787 或 9099 可能被占用。请在日志文件夹查看 yogo.log。")
            }
            }
        }
    }

    func makeWindow() {
        let configuration = WKWebViewConfiguration()
        configuration.websiteDataStore = .default()
        configuration.userContentController.add(self, name: "yogoTimer")
        let timerBridge = #"""
        (() => {
          const originalTimeout=window.setTimeout.bind(window), originalInterval=window.setInterval.bind(window);
          let next=1; const callbacks=new Map();
          function schedule(fn, delay, repeat, args){
            if(typeof fn!=="function") return (repeat?originalInterval:originalTimeout)(fn,delay,...args);
            const id=next++; callbacks.set(id,{fn,args,repeat});
            window.webkit.messageHandlers.yogoTimer.postMessage({op:"schedule",id,delay:Math.max(10,Number(delay)||0),repeat});
            return id;
          }
          window.__yogoTimers={fire(id){const task=callbacks.get(id); if(!task)return;
            if(!task.repeat)callbacks.delete(id); task.fn(...task.args);}};
          window.setTimeout=(fn,delay,...args)=>schedule(fn,delay,false,args);
          window.setInterval=(fn,delay,...args)=>schedule(fn,delay,true,args);
          window.clearTimeout=window.clearInterval=id=>{callbacks.delete(Number(id));
            window.webkit.messageHandlers.yogoTimer.postMessage({op:"cancel",id:Number(id)});};
        })();
        """#
        configuration.userContentController.addUserScript(WKUserScript(source: timerBridge, injectionTime: .atDocumentStart, forMainFrameOnly: true))
        // Background lighting is driven by timers in the existing control page.
        configuration.preferences.javaScriptCanOpenWindowsAutomatically = false
        web = WKWebView(frame: .zero, configuration: configuration)
        web.navigationDelegate = self
        window = NSWindow(contentRect: NSRect(x: 0, y: 0, width: 1260, height: 850),
                          styleMask: [.titled, .closable, .miniaturizable, .resizable], backing: .buffered, defer: false)
        window.title = "YogoDot · macOS"
        window.minSize = NSSize(width: 900, height: 650)
        window.contentView = web
        window.delegate = self
        window.isReleasedWhenClosed = false
        window.center()
        web.load(URLRequest(url: serverURL.appendingPathComponent("yogo.html")))
        if !CommandLine.arguments.contains("--background") { showWindow() }
    }

    @objc func showWindow() {
        guard window != nil else { return }
        window.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)
    }
    func windowShouldClose(_ sender: NSWindow) -> Bool {
        sender.orderOut(nil)
        return false
    }
    func applicationShouldHandleReopen(_ sender: NSApplication, hasVisibleWindows flag: Bool) -> Bool {
        showWindow()
        return true
    }
    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard message.name == "yogoTimer", message.frameInfo.isMainFrame,
              let body = message.body as? [String: Any], let id = body["id"] as? Int else { return }
        pageTimers.removeValue(forKey: id)?.invalidate()
        guard body["op"] as? String == "schedule" else { return }
        let delay = min(86400, max(0.01, (body["delay"] as? Double ?? 10) / 1000))
        let repeats = body["repeat"] as? Bool ?? false
        let timer = Timer(timeInterval: delay, repeats: repeats) { [weak self] _ in
            DispatchQueue.main.async {
                guard let self else { return }
                if !repeats { self.pageTimers.removeValue(forKey: id) }
                self.web.evaluateJavaScript("window.__yogoTimers.fire(\(id))", completionHandler: nil)
            }
        }
        pageTimers[id] = timer
        RunLoop.main.add(timer, forMode: .common)
    }
    func webView(_ webView: WKWebView, didStartProvisionalNavigation navigation: WKNavigation!) {
        for timer in pageTimers.values { timer.invalidate() }
        pageTimers.removeAll()
    }
    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        guard CommandLine.arguments.contains("--smoke-test") else { return }
        webView.evaluateJavaScript("window.testTicks=0; setInterval(()=>window.testTicks++,100); true") { _, _ in
            DispatchQueue.main.async {
                self.window.orderOut(nil)
                DispatchQueue.main.asyncAfter(deadline: .now() + 6) {
                    webView.evaluateJavaScript("JSON.stringify({designs:Object.keys(STATICS).length,newDesigns:Object.keys(YOGO_PATTERNS.designs).length,cards:document.querySelectorAll('#statics .chip').length,groups:Object.keys(GALLERY).length,ticks:window.testTicks,title:document.title,mac:MAC_APP})") { value, error in
                        DispatchQueue.main.async {
                            let output = (value as? String) ?? "{\"error\":\"JavaScript evaluation failed\"}"
                            try? output.write(to: self.support.appendingPathComponent("smoke-result.json"), atomically: true, encoding: .utf8)
                            NSApp.terminate(nil)
                        }
                    }
                }
            }
        }
    }
    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) { webView.reload() }
    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction,
                 decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        guard let url = navigationAction.request.url else { decisionHandler(.cancel); return }
        if url.host == "127.0.0.1" && url.port == serverURL.port { decisionHandler(.allow) }
        else { decisionHandler(.cancel); if url.scheme == "https" { NSWorkspace.shared.open(url) } }
    }

    @objc func screenLocked() { pendingSession = true; postSession() }
    @objc func screenUnlocked() { pendingSession = false; postSession() }
    func postSession() {
        var request = URLRequest(url: serverURL.appendingPathComponent("mac/session"))
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try? JSONSerialization.data(withJSONObject: ["locked": pendingSession])
        URLSession.shared.dataTask(with: request).resume()
    }
    func beginPolling() {
        poller = Timer.scheduledTimer(withTimeInterval: 2, repeats: true) { [weak self] _ in
            DispatchQueue.main.async {
                guard let self else { return }
                if self.backend?.isRunning != true { self.fail("本地服务已停止，请退出后重新打开。详情请查看 yogo.log。"); return }
                URLSession.shared.dataTask(with: self.serverURL.appendingPathComponent("want")) { data, _, _ in
                    guard let data, let result = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else { return }
                    if result["pop"] != nil || result["console"] != nil {
                        DispatchQueue.main.async { self.showWindow() }
                    }
                }.resume()
            }
        }
    }

    @objc func toggleStartup(_ sender: NSMenuItem) {
        do {
            if fileManager.fileExists(atPath: agentURL.path) {
                try fileManager.removeItem(at: agentURL)
                sender.state = .off
            } else {
                try fileManager.createDirectory(at: agentURL.deletingLastPathComponent(), withIntermediateDirectories: true)
                let plist: [String: Any] = ["Label": "io.github.nwang123.yogodot",
                    "ProgramArguments": ["/usr/bin/open", Bundle.main.bundlePath, "--args", "--background"],
                    "RunAtLoad": true, "LimitLoadToSessionType": "Aqua"]
                let data = try PropertyListSerialization.data(fromPropertyList: plist, format: .xml, options: 0)
                try data.write(to: agentURL, options: .atomic)
                sender.state = .on
            }
        } catch { alert("无法更改登录启动", error.localizedDescription) }
    }
    @objc func openData() { NSWorkspace.shared.open(support) }
    @objc func quit() { NSApp.terminate(nil) }
    func alert(_ title: String, _ message: String) {
        let alert = NSAlert(); alert.messageText = title; alert.informativeText = message
        NSApp.activate(ignoringOtherApps: true); alert.runModal()
    }
    func fail(_ message: String) { poller?.invalidate(); readyTimer?.invalidate(); alert("YogoDot 无法运行", message); NSApp.terminate(nil) }
    func applicationWillTerminate(_ notification: Notification) {
        poller?.invalidate(); readyTimer?.invalidate()
        for timer in pageTimers.values { timer.invalidate() }
        if backend?.isRunning == true { backend?.terminate(); backend?.waitUntilExit() }
        try? logHandle?.close()
        if let readyURL { try? fileManager.removeItem(at: readyURL) }
        if let activity { ProcessInfo.processInfo.endActivity(activity) }
        if lockFD >= 0 { Darwin.close(lockFD) }
    }
}

@main
struct YogoDotMain {
    @MainActor static func main() {
        let app = NSApplication.shared
        let delegate = AppDelegate()
        app.delegate = delegate
        app.setActivationPolicy(.accessory)
        withExtendedLifetime(delegate) { app.run() }
    }
}
