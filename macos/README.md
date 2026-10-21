# macOS 使用与维护

支持 macOS 13+，分别提供 arm64 与 x86_64 构建。菜单栏图标用于打开控制台和退出；关闭控制窗口会继续保留页面与键盘服务，不会退出应用。

## 数据、启动与卸载

- 数据：`~/Library/Application Support/YogoDot`。其中 `yogo.log` 为诊断日志，`config.bak` 是第一次读到的 64 字节配置备份。网页的图案、主题与亮度使用 WKWebView 的本地存储。
- 登录启动默认关闭。先把应用移动到固定位置，再在菜单中开启。程序只在你点击时创建 `~/Library/LaunchAgents/io.github.nwang123.yogodot.plist`，以普通用户身份在下次登录时打开应用。
- 移动应用后应关闭再开启登录启动，更新路径。
- 卸载：在菜单中关闭登录启动并退出，再删除应用和上述数据目录。没有后台系统扩展或固件安装。
- 本地服务只监听 `127.0.0.1:8787` 与 `127.0.0.1:9099`；端口冲突会显示错误，不会连接到占用端口的其他服务。

## 架构

`App.swift` 负责原生窗口、菜单栏、登录启动、锁屏与系统休眠通知。它使用公开的 WKScriptMessageHandler 与原生 Timer 驱动页面计时，避免窗口隐藏后 WebKit 将动画节流到每秒一次。它启动且管理应用包内的独立 Python 服务，并在退出时结束服务。意外退出时，服务检测父进程变化并自行退出。

`backend.py` 使用原有 `server.py`，将本机网页指令交给 `kbd.py`。`hid_macos.py` 只枚举 VID `373B` / UsagePage `FF60` / Usage `61` 的厂商接口，并以非独占方式打开设备，避免接管普通打字。Mac HIDAPI 收到不含 report ID 的 32 字节数据时，补上 report ID 0，让上层继续共用 Windows 的 33 字节协议。

空闲检测使用 CoreGraphics 的会话空闲计时，不安装键盘事件监听。锁屏和睡眠通知由原生宿主转发给省电循环。锁屏 / 空闲熄灯和低电量逻辑沿用上游；唤醒后控制页会重新连接和补推。

Windows 专属 `hud.py`、`hotkeys.py`、`capsule.py` 不会加载到 Mac 应用。Mac 提醒改为显示控制窗口，不提供顶部悬浮胶囊。

## 开发验证

```sh
python3 -m venv .buildenv
.buildenv/bin/python -m pip install -r macos/requirements.txt
.buildenv/bin/python -m unittest discover -s tests -v
./build-macos.sh
```

测试使用临时数据目录和模拟 HID，不会向真实键盘发送测试图案或改动本机登录启动。`YOGO_DATA_DIR` 可用于隔离开发数据；正常运行时不必设置。

构建产物采用临时签名，可验证完整性，但不能替代 Developer ID 与 Apple 公证。发布工作流使用固定版本的 Python 依赖，将两种架构的应用分别打包为 zip。推送 `mac-v*` 标签可发布预览版；也可更新 `macos/VERSION`，在 main 分支提交说明中加入 `[release mac]`，由构建流程创建对应标签与下载页。

## 实机验收（尚待完成）

- USB 与 2.4G 分别测试连接、读取配置、图案、背光、电量。
- 拔插接收器，键盘休眠后按键唤醒，确认自动恢复。
- 关闭窗口后台运行 30 分钟，确认动画和番茄钟继续。
- 锁屏、解锁、整机睡眠和唤醒，确认熄灯与恢复。
- 开启登录启动后重新登录；关闭后确认下次登录不启动。
- Intel Mac 与 Apple Silicon 分别运行各自的压缩包。

在这些项目完成前，版本应以预发布形式分发，并保留未实机验证的说明。
