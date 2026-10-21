# YogoDot for macOS

ATK YOGO 75 PRO（YOGO 75）点阵屏与背光控制工具的 macOS 移植版。
基于 [Wednesque/yogodot](https://github.com/Wednesque/yogodot)，保留 MIT 许可证与原作者署名。

## Mac 版新增

- 原生 macOS 菜单栏应用和控制窗口，无需 Chrome，也不依赖 WebHID。
- HIDAPI 通过 USB / 2.4G 接收器控制键盘，保留原协议、发送限速、画面去重及配置备份。
- 新增 **32 张原创 6×6 像素图案**：太空漫游、天气四季、零食时间、日常小物各 8 张；加上原有 48 张，共 **80 张**。图案可与主题背光搭配，选择会保存在本机。
- 保留 24 套主题、动画、番茄钟、专注模式、电量显示。
- 关闭窗口后驻留菜单栏，可手动开启「登录时启动」。锁屏、系统睡眠与空闲时熄灯，恢复后补推。
- 设置、日志和备份存入 `~/Library/Application Support/YogoDot`，不会写进应用包。

## 下载与使用

在本仓库的 **Releases** 中选择与你的 Mac 对应的压缩包：

| 下载包 | 适用机型 |
| --- | --- |
| `YogoDot-macos-arm64.zip` | Apple Silicon（M 系列芯片） |
| `YogoDot-macos-x86_64.zip` | Intel Mac |

1. 要求 **macOS 13 Ventura 或更高版本**。解压，把 `YogoDot.app` 拖入「应用程序」。
2. 用数据线或 2.4G 接收器连接 YOGO 75 PRO；蓝牙不支持此控制协议。
3. 打开应用，选择图案 / 主题。未连接键盘时也能浏览图库。
4. 点菜单栏键盘图标可以重新打开窗口、设置登录启动、查看日志或退出。

应用目前仅作临时签名，**没有 Apple Developer ID 签名或公证**。首次运行如被 macOS 阻止，可在确认下载来自本仓库后，通过「系统设置 → 隐私与安全性 → 仍要打开」允许。无需关闭 Gatekeeper 或 SIP。如系统要求输入监控，请按系统提示允许应用后重开。

**验证范围：** 自动测试覆盖 HID 报告格式转换、目标接口筛选、协议分包、回包、电量、省电与本地服务；Apple Silicon 上可构建应用。真实键盘上的 USB、2.4G、睡眠恢复和长时间后台动画仍需实机验证，Intel 包由独立构建验证。请勿把软件测试通过理解为全部硬件兼容性已验证。

## Mac 源码构建

安装 Python 3.12 或 3.13 以及 Xcode Command Line Tools，然后在项目目录运行：

```sh
./build-macos.sh
```

脚本创建隔离环境、安装固定版本依赖、运行测试、编译 Swift 窗口、打包独立 Python 服务，最终生成 `dist/YogoDot.app` 和本机架构的 zip。发行包不需要用户安装 Python。
可用 `YOGO_PYTHON=/path/to/python3 ./build-macos.sh` 选择解释器。
详见 [Mac 说明](macos/README.md)。GitHub Actions 会在 Apple Silicon 和 Intel runner 上分别构建，标签 `mac-v*` 会创建带两个压缩包的预发布版本。

## 已知限制

- 仅适用于 ATK YOGO 75 PRO 已知的控制接口；不会刷固件或发送恢复出厂命令。
- 不要同时运行 ATK HUB 与 YogoDot，以免争抢设备。
- 图案实时发送，不保存进键盘；应用需要常驻后台。
- 原厂灯效由键盘固件运行，自动熄灯只完整覆盖本软件的逐键背光。
- Windows 的顶部 HUD 胶囊和全局中键热键没有移植。Mac 的番茄钟 / Claude 提醒会打开控制窗口。
- Claude 模式默认关闭；只有手动打开后才会启动原有状态与额度功能。Mac 不自动读取钥匙串，可选择手动提供 token 或使用 statusLine 上报。

## Windows 与上游

Windows 入口仍为 `yogo.pyw`，构建脚本仍为 `build.cmd`。新增图库也可在 Windows 使用。
原作者的完整文档见 [上游 README](docs/README.upstream.md)。

## English

A macOS port of [Wednesque's YogoDot](https://github.com/Wednesque/yogodot) for the ATK YOGO 75 PRO keyboard. Includes a native Swift menu bar / WKWebView shell, a shared Python protocol engine with a macOS HIDAPI transport, and 32 new original 6×6 designs (80 total). macOS 13+, USB or 2.4 GHz only. Build with `./build-macos.sh`; architecture-specific standalone apps are produced by CI. Releases are ad-hoc signed, not notarized. Real keyboard validation remains pending. See the limitations above and [macOS notes](macos/README.md).

MIT License. Original project copyright retained in [LICENSE](LICENSE).
