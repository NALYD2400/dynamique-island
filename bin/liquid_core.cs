using System;
using System.Runtime.InteropServices;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Threading.Tasks;
using System.Text.Json;
using System.Linq;
using System.Drawing;
using System.Drawing.Imaging;
using Windows.Media.Control;
using Windows.Storage.Streams;
using Windows.Devices.Radios;
using Microsoft.Win32;

namespace LiquidCore {
    // --- Win32 COM Interfaces for Audio Session Management (WASAPI) ---
    [ComImport]
    [Guid("BCDE0395-E52F-467C-8E3D-C4579291692E")]
    internal class MMDeviceEnumerator { }

    [ComImport]
    [Guid("A95664D2-9614-4F35-A746-DE8DB63617E6")]
    [InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    internal interface IMMDeviceEnumerator {
        [PreserveSig] int EnumAudioEndpoints(int dataFlow, int dwStateMask, out IMMDeviceCollection ppDevices);
        [PreserveSig] int GetDefaultAudioEndpoint(int dataFlow, int role, out IMMDevice ppEndpoint);
        [PreserveSig] int GetDevice([MarshalAs(UnmanagedType.LPWStr)] string pwstrId, out IMMDevice ppDevice);
    }

    [ComImport]
    [Guid("D666063F-1587-4E43-81F1-B948E807363F")]
    [InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    internal interface IMMDevice {
        [PreserveSig] int Activate(ref Guid iid, uint dwClsCtx, IntPtr pActivationParams, [MarshalAs(UnmanagedType.IUnknown)] out object ppInterface);
        [PreserveSig] int OpenPropertyStore(uint stgmAccess, out IPropertyStore ppProperties);
        [PreserveSig] int GetId([MarshalAs(UnmanagedType.LPWStr)] out string ppstrId);
        [PreserveSig] int GetState(out uint pdwState);
    }

    [ComImport]
    [Guid("0BD7A1BE-7A1A-44DB-8397-CC5392387B5E")]
    [InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    internal interface IMMDeviceCollection {
        [PreserveSig] int GetCount(out uint pcDevices);
        [PreserveSig] int Item(uint nDevice, out IMMDevice ppDevice);
    }

    [ComImport]
    [Guid("886d8eeb-8cf2-4446-8d02-cdba1dbdcf99")]
    [InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    internal interface IPropertyStore {
        [PreserveSig] int GetCount(out uint cProps);
        [PreserveSig] int GetAt(uint iProp, out PropertyKey pkey);
        [PreserveSig] int GetValue(ref PropertyKey key, out PropVariant pv);
        [PreserveSig] int SetValue(ref PropertyKey key, ref PropVariant propvar);
        [PreserveSig] int Commit();
    }

    [StructLayout(LayoutKind.Sequential)]
    internal struct PropertyKey {
        public Guid fmtid;
        public uint pid;
    }

    [StructLayout(LayoutKind.Explicit)]
    internal struct PropVariant {
        [FieldOffset(0)] public ushort vt;
        [FieldOffset(2)] public ushort wReserved1;
        [FieldOffset(4)] public ushort wReserved2;
        [FieldOffset(6)] public ushort wReserved3;
        [FieldOffset(8)] public IntPtr pwszVal;
    }

    [ComImport]
    [Guid("f8679f50-850a-41cf-9c72-430f290290c8")]
    [InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    internal interface IPolicyConfig {
        [PreserveSig] int GetMixFormat();
        [PreserveSig] int GetDeviceFormat();
        [PreserveSig] int ResetDeviceFormat();
        [PreserveSig] int SetDeviceFormat();
        [PreserveSig] int GetProcessingPeriod();
        [PreserveSig] int SetProcessingPeriod();
        [PreserveSig] int GetShareMode();
        [PreserveSig] int SetShareMode();
        [PreserveSig] int GetPropertyValue();
        [PreserveSig] int SetPropertyValue();
        [PreserveSig] int SetDefaultEndpoint([MarshalAs(UnmanagedType.LPWStr)] string wszDeviceId, uint eRole);
        [PreserveSig] int SetEndpointVisibility([MarshalAs(UnmanagedType.LPWStr)] string wszDeviceId, int bVisible);
    }

    [ComImport]
    [Guid("870AF99C-171D-4F9E-AF0D-E63DF40C2BC9")]
    internal class PolicyConfigClient { }

    [ComImport]
    [Guid("77AA99A0-1BD6-484F-8BC7-2C654C9A9B6F")]
    [InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    internal interface IAudioSessionManager2 {
        [PreserveSig] int GetAudioSessionControl(ref Guid AudioSessionGuid, uint StreamFlags, out IAudioSessionControl SessionControl);
        [PreserveSig] int GetSimpleAudioVolume(ref Guid AudioSessionGuid, uint StreamFlags, out ISimpleAudioVolume AudioVolume);
        [PreserveSig] int GetSessionEnumerator(out IAudioSessionEnumerator SessionEnum);
    }

    [ComImport]
    [Guid("E2F5BB11-0570-40CA-ACDD-3AA01277DEE8")]
    [InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    internal interface IAudioSessionEnumerator {
        [PreserveSig] int GetCount(out int SessionCount);
        [PreserveSig] int GetSession(int SessionCount, [MarshalAs(UnmanagedType.Interface)] out IAudioSessionControl retVal);
    }

    [ComImport]
    [Guid("F4B1A599-7266-4319-A8CA-E70ACB11E8CD")]
    [InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    internal interface IAudioSessionControl {
        [PreserveSig] int GetState(out int pRetVal);
        [PreserveSig] int GetDisplayName([MarshalAs(UnmanagedType.LPWStr)] out string pRetVal);
        [PreserveSig] int SetDisplayName([MarshalAs(UnmanagedType.LPWStr)] string Value, [In] ref Guid EventContext);
        [PreserveSig] int GetIconPath([MarshalAs(UnmanagedType.LPWStr)] out string pRetVal);
        [PreserveSig] int SetIconPath([MarshalAs(UnmanagedType.LPWStr)] string Value, [In] ref Guid EventContext);
        [PreserveSig] int GetGroupingParam(out Guid pRetVal);
        [PreserveSig] int SetGroupingParam([In] ref Guid Override, [In] ref Guid EventContext);
        [PreserveSig] int RegisterAudioSessionNotification(object NewNotifications);
        [PreserveSig] int UnregisterAudioSessionNotification(object NewNotifications);
    }

    [ComImport]
    [Guid("bfb7ff88-7239-4fc9-8fa2-07c950be9c6d")]
    [InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    internal interface IAudioSessionControl2 {
        [PreserveSig] int GetState(out int pRetVal);
        [PreserveSig] int GetDisplayName([MarshalAs(UnmanagedType.LPWStr)] out string pRetVal);
        [PreserveSig] int SetDisplayName([MarshalAs(UnmanagedType.LPWStr)] string Value, [In] ref Guid EventContext);
        [PreserveSig] int GetIconPath([MarshalAs(UnmanagedType.LPWStr)] out string pRetVal);
        [PreserveSig] int SetIconPath([MarshalAs(UnmanagedType.LPWStr)] string Value, [In] ref Guid EventContext);
        [PreserveSig] int GetGroupingParam(out Guid pRetVal);
        [PreserveSig] int SetGroupingParam([In] ref Guid Override, [In] ref Guid EventContext);
        [PreserveSig] int RegisterAudioSessionNotification(object NewNotifications);
        [PreserveSig] int UnregisterAudioSessionNotification(object NewNotifications);

        // IAudioSessionControl2 methods
        [PreserveSig] int GetSessionIdentifier([MarshalAs(UnmanagedType.LPWStr)] out string pRetVal);
        [PreserveSig] int GetSessionInstanceIdentifier([MarshalAs(UnmanagedType.LPWStr)] out string pRetVal);
        [PreserveSig] int GetProcessId(out uint pRetVal);
        [PreserveSig] int IsSystemSoundsSession();
        [PreserveSig] int SetDuckingPreference(bool optOut);
    }

    [ComImport]
    [Guid("87CE5498-68D6-44E5-9215-6DA47EF883D8")]
    [InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    internal interface ISimpleAudioVolume {
        [PreserveSig] int SetMasterVolume(float fLevel, ref Guid EventContext);
        [PreserveSig] int GetMasterVolume(out float pfLevel);
        [PreserveSig] int SetMute(bool bMute, ref Guid EventContext);
        [PreserveSig] int GetMute(out bool pbMute);
    }

    [ComImport]
    [Guid("5CDF2C82-841E-4546-9722-0CF74078229A")]
    [InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    internal interface IAudioEndpointVolume {
        int RegisterControlChangeNotify(IntPtr pNotify);
        int UnregisterControlChangeNotify(IntPtr pNotify);
        int GetChannelCount(out uint pnChannelCount);
        [PreserveSig] int SetMasterVolumeLevel(float fLevelDB, ref Guid pguidEventContext);
        [PreserveSig] int SetMasterVolumeLevelScalar(float fLevel, ref Guid pguidEventContext);
        [PreserveSig] int GetMasterVolumeLevel(out float pfLevelDB);
        [PreserveSig] int GetMasterVolumeLevelScalar(out float pfLevel);
        [PreserveSig] int SetChannelVolumeLevel(uint nChannel, float fLevelDB, ref Guid pguidEventContext);
        [PreserveSig] int SetChannelVolumeLevelScalar(uint nChannel, float fLevel, ref Guid pguidEventContext);
        [PreserveSig] int GetChannelVolumeLevel(uint nChannel, out float pfLevelDB);
        [PreserveSig] int GetChannelVolumeLevelScalar(uint nChannel, out float pfLevel);
        [PreserveSig] int SetMute([MarshalAs(UnmanagedType.Bool)] bool bMute, ref Guid pguidEventContext);
        [PreserveSig] int GetMute([MarshalAs(UnmanagedType.Bool)] out bool pbMute);
    }

    [ComImport]
    [Guid("C02216F6-8C67-4B5B-9D00-D008E73E0064")]
    [InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    internal interface IAudioMeterInformation {
        [PreserveSig] int GetPeakValue(out float pfPeak);
        [PreserveSig] int GetMeteringChannelCount(out int pnChannelCount);
        [PreserveSig] int GetChannelsPeakValues(int u32ChannelCount, [Out, MarshalAs(UnmanagedType.LPArray, SizeParamIndex = 0)] float[] afPeakValues);
        [PreserveSig] int QueryHardwareSupport(out int pdwHardwareSupportMask);
    }

    public class AudioSessionInfo {
        public uint pid { get; set; }
        public string name { get; set; } = "";
        public string title { get; set; } = "";
        public string icon { get; set; } = "";
        public float volume { get; set; }
        public bool muted { get; set; }
        public int state { get; set; }
        public bool active { get; set; }
    }

    public class AudioPeakInfo {
        public float peak { get; set; }
        public float left { get; set; }
        public float right { get; set; }
        public int channels { get; set; }
    }

    public class SmtcResponse {
        public string status { get; set; } = "";
        public string title { get; set; } = "";
        public string artist { get; set; } = "";
        public string cover { get; set; } = "";
        public string appId { get; set; } = "";
        public bool isPlaying { get; set; }
        public int progress { get; set; }
        public int duration { get; set; }
        public string source { get; set; } = "";
    }

    public class AudioDevice {
        public string id { get; set; } = "";
        public string name { get; set; } = "";
        public bool isDefault { get; set; }
    }

    class Program {
        [DllImport("Ole32.dll", PreserveSig = false)]
        internal static extern void PropVariantClear(ref PropVariant pvar);

        [StructLayout(LayoutKind.Sequential)]
        private struct RECT {
            public int Left;
            public int Top;
            public int Right;
            public int Bottom;
        }

        [StructLayout(LayoutKind.Sequential)]
        private struct MONITORINFO {
            public int cbSize;
            public RECT rcMonitor;
            public RECT rcWork;
            public uint dwFlags;
        }

        [DllImport("user32.dll")]
        private static extern IntPtr GetForegroundWindow();

        [DllImport("user32.dll")]
        private static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);

        [DllImport("user32.dll")]
        private static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);

        [DllImport("user32.dll")]
        private static extern IntPtr MonitorFromWindow(IntPtr hwnd, uint dwFlags);

        [DllImport("user32.dll")]
        private static extern bool GetMonitorInfo(IntPtr hMonitor, ref MONITORINFO lpmi);

        [DllImport("user32.dll", CharSet = CharSet.Auto)]
        private static extern int SystemParametersInfo(int uAction, int uParam, string lpvParam, int fuWinIni);

        private const int SPI_SETDESKWALLPAPER = 0x0014;
        private const int SPIF_UPDATEINIFILE = 0x01;
        private const int SPIF_SENDCHANGE = 0x02;

        [DllImport("user32.dll")]
        private static extern int GetSystemMetrics(int nIndex);

        private const int SM_CXSCREEN = 0;
        private const int SM_CYSCREEN = 1;

        private static bool IsSafeTextArg(string value) {
            return !string.IsNullOrWhiteSpace(value) &&
                   value.Length <= 2048 &&
                   value.IndexOf('\r') < 0 &&
                   value.IndexOf('\n') < 0;
        }

        private static void SetWallpaper(string path) {
            if (!IsSafeTextArg(path)) return;
            SystemParametersInfo(SPI_SETDESKWALLPAPER, 0, path, SPIF_UPDATEINIFILE | SPIF_SENDCHANGE);
        }

        private static Bitmap BoxBlur(Bitmap bmp, int radius) {
            if (radius <= 0) return bmp;
            
            Bitmap result = new Bitmap(bmp.Width, bmp.Height);
            int width = bmp.Width;
            int height = bmp.Height;

            // Horizontal pass
            for (int y = 0; y < height; y++) {
                for (int x = 0; x < width; x++) {
                    int rSum = 0, gSum = 0, bSum = 0, count = 0;
                    for (int k = -radius; k <= radius; k++) {
                        int px = x + k;
                        if (px >= 0 && px < width) {
                            Color c = bmp.GetPixel(px, y);
                            rSum += c.R;
                            gSum += c.G;
                            bSum += c.B;
                            count++;
                        }
                    }
                    result.SetPixel(x, y, Color.FromArgb(rSum / count, gSum / count, bSum / count));
                }
            }

            // Vertical pass
            Bitmap finalBmp = new Bitmap(width, height);
            for (int x = 0; x < width; x++) {
                for (int y = 0; y < height; y++) {
                    int rSum = 0, gSum = 0, bSum = 0, count = 0;
                    for (int k = -radius; k <= radius; k++) {
                        int py = y + k;
                        if (py >= 0 && py < height) {
                            Color c = result.GetPixel(x, py);
                            rSum += c.R;
                            gSum += c.G;
                            bSum += c.B;
                            count++;
                        }
                    }
                    finalBmp.SetPixel(x, y, Color.FromArgb(rSum / count, gSum / count, bSum / count));
                }
            }

            result.Dispose();
            return finalBmp;
        }

        private static Bitmap MultiPassBoxBlur(Bitmap bmp, int radius, int passes) {
            passes = Math.Clamp(passes, 1, 15);
            Bitmap current = (Bitmap)bmp.Clone();
            for (int i = 0; i < passes; i++) {
                Bitmap next = BoxBlur(current, radius);
                current.Dispose();
                current = next;
            }
            return current;
        }

        private static void SetWallpaperWithBlur(string imagePath, string style, int passes, int darkenPercent) {
            try {
                if (!IsSafeTextArg(imagePath)) return;
                if (!File.Exists(imagePath)) return;

                int targetWidth = GetSystemMetrics(SM_CXSCREEN);
                int targetHeight = GetSystemMetrics(SM_CYSCREEN);
                if (targetWidth <= 0) targetWidth = 1920;
                if (targetHeight <= 0) targetHeight = 1080;

                Bitmap original;
                using (var fs = new FileStream(imagePath, FileMode.Open, FileAccess.Read, FileShare.ReadWrite)) {
                    using (var temp = new Bitmap(fs)) {
                        original = new Bitmap(temp);
                    }
                }
                using (original) {
                    int thumbWidth = 200;
                    int thumbHeight = 200;
                    using (Bitmap tiny = new Bitmap(thumbWidth, thumbHeight)) {
                        using (Graphics g = Graphics.FromImage(tiny)) {
                            g.InterpolationMode = System.Drawing.Drawing2D.InterpolationMode.HighQualityBilinear;
                            g.DrawImage(original, 0, 0, thumbWidth, thumbHeight);
                        }

                        using (Bitmap blurredTiny = MultiPassBoxBlur(tiny, 3, passes)) {
                            using (Bitmap finalWallpaper = new Bitmap(targetWidth, targetHeight)) {
                                using (Graphics g = Graphics.FromImage(finalWallpaper)) {
                                    g.InterpolationMode = System.Drawing.Drawing2D.InterpolationMode.HighQualityBicubic;
                                    g.PixelOffsetMode = System.Drawing.Drawing2D.PixelOffsetMode.HighQuality;

                                    float brightness = 1.0f - (Math.Clamp(darkenPercent, 0, 50) / 100f);
                                    var colorMatrix = new ColorMatrix(new float[][] {
                                        new float[] {brightness, 0, 0, 0, 0},
                                        new float[] {0, brightness, 0, 0, 0},
                                        new float[] {0, 0, brightness, 0, 0},
                                        new float[] {0, 0, 0, 1, 0},
                                        new float[] {0, 0, 0, 0, 1}
                                    });

                                    using (ImageAttributes attributes = new ImageAttributes()) {
                                        attributes.SetColorMatrix(colorMatrix, ColorMatrixFlag.Default, ColorAdjustType.Bitmap);
                                        g.DrawImage(blurredTiny, new Rectangle(0, 0, targetWidth, targetHeight),
                                            0, 0, blurredTiny.Width, blurredTiny.Height, GraphicsUnit.Pixel, attributes);
                                    }

                                    if (style == "cinematic") {
                                        int coverSize = (int)(targetHeight * 0.6);
                                        int coverX = (targetWidth - coverSize) / 2;
                                        int coverY = (targetHeight - coverSize) / 2;

                                        int shadowOffset = 4;
                                        int shadowSize = 20;
                                        for (int i = shadowSize; i > 0; i--) {
                                            int alpha = (int)(8.0 * (1.0 - (double)i / shadowSize));
                                            if (alpha > 0) {
                                                using (SolidBrush shadowBrush = new SolidBrush(Color.FromArgb(alpha, 0, 0, 0))) {
                                                    int sX = coverX + shadowOffset - i;
                                                    int sY = coverY + shadowOffset - i;
                                                    int sW = coverSize + (2 * i);
                                                    int sH = coverSize + (2 * i);
                                                    g.FillRectangle(shadowBrush, new Rectangle(sX, sY, sW, sH));
                                                }
                                            }
                                        }

                                        g.DrawImage(original, new Rectangle(coverX, coverY, coverSize, coverSize));
                                    }
                                }

                                string dir = Path.GetDirectoryName(imagePath) ?? Path.GetTempPath();
                                string suffix = imagePath.Contains("_2.jpg") ? "_2" : "_1";
                                string tempWpPath = Path.Combine(dir, "processed_wallpaper" + suffix + ".jpg");

                                if (File.Exists(tempWpPath)) {
                                    try { File.Delete(tempWpPath); } catch {}
                                }

                                finalWallpaper.Save(tempWpPath, ImageFormat.Jpeg);
                                SetWallpaper(tempWpPath);
                            }
                        }
                    }
                }
            } catch (Exception ex) {
                Console.Error.WriteLine("Error blurring wallpaper: " + ex.Message);
                SetWallpaper(imagePath);
            }
        }

        private static string GetCurrentWallpaper() {
            try {
                using (RegistryKey? key = Registry.CurrentUser.OpenSubKey(@"Control Panel\Desktop")) {
                    if (key != null) {
                        var val = key.GetValue("Wallpaper");
                        if (val != null) {
                            return val.ToString() ?? "";
                        }
                    }
                }
            } catch { }
            return "";
        }

        private static GlobalSystemMediaTransportControlsSessionManager? _sessionManager;
        private static string _lastTitle = "";
        private static string _lastArtist = "";
        private static string _lastCoverBase64 = "";
        private static DateTime _lastSmtcInitAttemptUtc = DateTime.MinValue;
        private static string _lastSmtcInitError = "";
        private static int _smtcInitFailures = 0;

        private static bool IsBrowserAppId(string appId) {
            if (string.IsNullOrWhiteSpace(appId)) return false;
            string id = appId.ToLowerInvariant();
            return id.Contains("chrome") || id.Contains("msedge") || id.Contains("edge") || id.Contains("firefox");
        }

        private static string GetBrowserProcessName(string appId) {
            if (string.IsNullOrWhiteSpace(appId)) return "";
            string id = appId.ToLowerInvariant();
            if (id.Contains("msedge") || id.Contains("edge")) return "msedge";
            if (id.Contains("firefox")) return "firefox";
            if (id.Contains("chrome")) return "chrome";
            return "";
        }

        private static string InferStreamingService(string text) {
            if (string.IsNullOrWhiteSpace(text)) return "";

            string normalized = text.ToLowerInvariant();
            if (normalized.Contains("netflix")) return "netflix";
            if (normalized.Contains("youtube") || normalized.Contains("yt music")) return "youtube";
            if (normalized.Contains("disney+") || normalized.Contains("disney plus") || normalized.Contains("disneyplus") || normalized.Contains("disney")) return "disney";
            if (normalized.Contains("crunchyroll")) return "crunchyroll";
            if (normalized.Contains("spotify")) return "spotify";
            if (normalized.Contains("deezer")) return "deezer";
            if (normalized.Contains("prime video") || normalized.Contains("amazon prime")) return "primevideo";
            return "";
        }

        private static string GetServiceDisplayName(string serviceId) {
            switch ((serviceId ?? "").ToLowerInvariant()) {
                case "netflix": return "Netflix";
                case "youtube": return "YouTube";
                case "disney": return "Disney+";
                case "crunchyroll": return "Crunchyroll";
                case "spotify": return "Spotify";
                case "deezer": return "Deezer";
                case "primevideo": return "Prime Video";
                default: return "";
            }
        }

        private static string InferStreamingAppId(string appId, string title, string artist) {
            string directMatch = InferStreamingService($"{title} {artist}");
            if (!string.IsNullOrEmpty(directMatch)) {
                return directMatch;
            }

            if (!IsBrowserAppId(appId)) {
                return appId;
            }

            string processName = GetBrowserProcessName(appId);
            if (string.IsNullOrEmpty(processName)) {
                return appId;
            }

            try {
                foreach (var process in Process.GetProcessesByName(processName)) {
                    try {
                        string windowTitle = process.MainWindowTitle ?? "";
                        string match = InferStreamingService(windowTitle);
                        if (!string.IsNullOrEmpty(match)) {
                            return match;
                        }
                    } catch {
                        // Ignore inaccessible process window titles
                    }
                }
            } catch {
                // Ignore process enumeration failures
            }

            return appId;
        }

        private static async Task<bool> EnsureSmtcManagerAsync(bool forceRetry = false) {
            if (_sessionManager != null) return true;

            DateTime now = DateTime.UtcNow;
            if (!forceRetry && (now - _lastSmtcInitAttemptUtc).TotalSeconds < 5) {
                return false;
            }

            _lastSmtcInitAttemptUtc = now;
            try {
                _sessionManager = await GlobalSystemMediaTransportControlsSessionManager.RequestAsync();
                _lastSmtcInitError = "";
                return _sessionManager != null;
            } catch (Exception ex) {
                _smtcInitFailures++;
                _lastSmtcInitError = ex.GetType().Name + ": " + ex.Message;
                Console.Error.WriteLine("Failed to initialize SMTC: " + _lastSmtcInitError);
                return false;
            }
        }

        private static bool IsOwnProcess(string processName) {
            string name = (processName ?? "").ToLowerInvariant();
            return name.Contains("liquid dynamic island") ||
                   name.Contains("liquid_core") ||
                   name == "electron";
        }

        private static bool IsLikelyMediaProcess(string processName, string windowTitle) {
            string name = (processName ?? "").ToLowerInvariant();
            string title = (windowTitle ?? "").ToLowerInvariant();

            if (IsOwnProcess(name)) return false;

            string[] mediaNames = {
                "spotify", "chrome", "msedge", "firefox", "brave", "opera",
                "vlc", "wmplayer", "music.ui", "itunes", "deezer", "tidal",
                "foobar2000", "winamp", "aimp", "potplayer", "mpv", "plex",
                "netflix", "primevideo"
            };

            foreach (string mediaName in mediaNames) {
                if (name.Contains(mediaName)) return true;
            }

            return !string.IsNullOrWhiteSpace(InferStreamingService(title));
        }

        private static string ToDisplayAppName(string processName) {
            string name = (processName ?? "").Trim();
            if (string.IsNullOrWhiteSpace(name)) return "Media";
            string lower = name.ToLowerInvariant();
            if (lower.Contains("chrome")) return "Chrome";
            if (lower.Contains("msedge")) return "Microsoft Edge";
            if (lower.Contains("firefox")) return "Firefox";
            if (lower.Contains("brave")) return "Brave";
            if (lower.Contains("spotify")) return "Spotify";
            if (lower.Contains("vlc")) return "VLC";
            if (lower.Contains("music.ui")) return "Lecteur multimedia";
            return char.ToUpperInvariant(name[0]) + name.Substring(1);
        }

        private static string CleanFallbackTitle(string title, string processName) {
            string clean = (title ?? "").Trim();
            if (string.IsNullOrWhiteSpace(clean)) return "";

            string[] suffixes = {
                " - Google Chrome",
                " - Microsoft Edge",
                " - Mozilla Firefox",
                " - Brave",
                " - Opera",
                " - YouTube",
                " - YouTube Music",
                " | Spotify",
                " - Spotify"
            };

            foreach (string suffix in suffixes) {
                if (clean.EndsWith(suffix, StringComparison.OrdinalIgnoreCase)) {
                    clean = clean.Substring(0, clean.Length - suffix.Length).Trim();
                }
            }

            string appName = ToDisplayAppName(processName);
            if (clean.Equals(appName, StringComparison.OrdinalIgnoreCase)) return "";
            return clean;
        }

        private static SmtcResponse BuildFallbackMediaResponse() {
            try {
                var sessions = GetAudioSessions()
                    .Where(s => s.active && !s.muted && s.volume > 0 && !IsOwnProcess(s.name))
                    .ToList();

                if (sessions.Count == 0) {
                    return new SmtcResponse { status = "no_media", source = "wasapi" };
                }

                var mediaCandidates = sessions
                    .Where(s => IsLikelyMediaProcess(s.name, s.title))
                    .ToList();

                if (mediaCandidates.Count == 0) {
                    return new SmtcResponse { status = "no_media", source = "wasapi" };
                }

                AudioSessionInfo? picked = mediaCandidates
                    .OrderByDescending(s => !string.IsNullOrWhiteSpace(s.title))
                    .FirstOrDefault();

                if (picked == null) {
                    return new SmtcResponse { status = "no_media", source = "wasapi" };
                }

                string appId = InferStreamingService($"{picked.name} {picked.title}");
                if (string.IsNullOrWhiteSpace(appId)) {
                    appId = picked.name ?? "";
                }

                string service = GetServiceDisplayName(appId);
                string title = CleanFallbackTitle(picked.title, picked.name ?? "");
                string artist = !string.IsNullOrWhiteSpace(service) ? service : ToDisplayAppName(picked.name ?? "");

                if (string.IsNullOrWhiteSpace(title)) {
                    title = "Lecture detectee";
                }

                return new SmtcResponse {
                    status = "success",
                    title = title,
                    artist = artist,
                    cover = picked.icon ?? "",
                    appId = appId,
                    isPlaying = true,
                    progress = 0,
                    duration = 0,
                    source = "wasapi"
                };
            } catch (Exception ex) {
                Console.Error.WriteLine("Fallback media detection failed: " + ex.Message);
                return new SmtcResponse { status = "no_media", source = "wasapi" };
            }
        }

        private static string GetDiagnosticsJson() {
            var sessions = GetAudioSessions();
            var payload = new {
                osVersion = Environment.OSVersion.VersionString,
                process64Bit = Environment.Is64BitProcess,
                smtcReady = _sessionManager != null,
                smtcFailures = _smtcInitFailures,
                lastSmtcError = _lastSmtcInitError,
                sessionCount = sessions.Count,
                activeSessionCount = sessions.Count(s => s.active),
                sessions = sessions.Select(s => new {
                    pid = s.pid,
                    name = s.name,
                    title = s.title,
                    volume = Math.Round(s.volume, 1),
                    muted = s.muted,
                    state = s.state,
                    active = s.active
                }).Take(12).ToList()
            };

            return JsonSerializer.Serialize(payload);
        }

        // --- Wi-Fi Controls ---
        private static async Task<string> SetWifiStateAsync(bool turnOn) {
            try {
                var accessStatus = await Radio.RequestAccessAsync();
                if (accessStatus != RadioAccessStatus.Allowed) {
                    return "denied";
                }
                var radios = await Radio.GetRadiosAsync();
                var wifiRadio = radios.FirstOrDefault(r => r.Kind == RadioKind.WiFi);
                if (wifiRadio != null) {
                    var result = await wifiRadio.SetStateAsync(turnOn ? RadioState.On : RadioState.Off);
                    return result == RadioAccessStatus.Allowed ? "ok" : "failed";
                }
                return "not_found";
            } catch (Exception ex) {
                return "error: " + ex.Message;
            }
        }

        private static async Task<string> GetWifiStateAsync() {
            try {
                var accessStatus = await Radio.RequestAccessAsync();
                if (accessStatus != RadioAccessStatus.Allowed) return "unknown";
                var radios = await Radio.GetRadiosAsync();
                var wifiRadio = radios.FirstOrDefault(r => r.Kind == RadioKind.WiFi);
                if (wifiRadio != null) {
                    return wifiRadio.State == RadioState.On ? "on" : "off";
                }
                return "not_found";
            } catch {
                return "unknown";
            }
        }

        private static List<AudioDevice> GetAudioDevices(int dataFlow) {
            var result = new List<AudioDevice>();
            IMMDeviceEnumerator? deviceEnumerator = null;
            IMMDeviceCollection? collection = null;
            IMMDevice? defaultDevice = null;
            
            try {
                deviceEnumerator = new MMDeviceEnumerator() as IMMDeviceEnumerator;
                if (deviceEnumerator == null) return result;

                string defaultId = "";
                if (deviceEnumerator.GetDefaultAudioEndpoint(dataFlow, 0, out defaultDevice) == 0 && defaultDevice != null) {
                    defaultDevice.GetId(out defaultId);
                }

                if (deviceEnumerator.EnumAudioEndpoints(dataFlow, 1, out collection) == 0 && collection != null) {
                    uint count;
                    collection.GetCount(out count);
                    for (uint i = 0; i < count; i++) {
                        IMMDevice? device = null;
                        IPropertyStore? store = null;
                        try {
                            collection.Item(i, out device);
                            if (device == null) continue;

                            device.GetId(out string id);
                            string friendlyName = "Inconnu";

                            if (device.OpenPropertyStore(0, out store) == 0 && store != null) {
                                var key = new PropertyKey {
                                    fmtid = new Guid("a45c254e-df1c-4efd-8020-67d146a850e0"),
                                    pid = 14
                                };
                                var pv = new PropVariant();
                                if (store.GetValue(ref key, out pv) == 0 && pv.vt == 31) { // VT_LPWSTR = 31
                                    friendlyName = Marshal.PtrToStringUni(pv.pwszVal) ?? "Inconnu";
                                    PropVariantClear(ref pv);
                                }
                            }

                            result.Add(new AudioDevice {
                                id = id,
                                name = friendlyName,
                                isDefault = (id == defaultId)
                            });
                        } catch {
                            // Suppress device item failures
                        } finally {
                            if (store != null) Marshal.ReleaseComObject(store);
                            if (device != null) Marshal.ReleaseComObject(device);
                        }
                    }
                }
            } catch (Exception ex) {
                Console.Error.WriteLine("Error enumerating audio devices: " + ex.Message);
            } finally {
                if (defaultDevice != null) Marshal.ReleaseComObject(defaultDevice);
                if (collection != null) Marshal.ReleaseComObject(collection);
                if (deviceEnumerator != null) Marshal.ReleaseComObject(deviceEnumerator);
            }

            return result;
        }

        private static bool SetDefaultAudioDevice(string deviceId) {
            try {
                if (string.IsNullOrWhiteSpace(deviceId)) return false;
                var policyConfig = new PolicyConfigClient() as IPolicyConfig;
                if (policyConfig == null) return false;

                // Set default for Console (0), Multimedia (1), and Communications (2) roles
                policyConfig.SetDefaultEndpoint(deviceId, 0);
                policyConfig.SetDefaultEndpoint(deviceId, 1);
                policyConfig.SetDefaultEndpoint(deviceId, 2);
                return true;
            } catch (Exception ex) {
                Console.Error.WriteLine("Error setting default audio endpoint: " + ex.Message);
                return false;
            }
        }

        // --- Bluetooth Controls ---
        private static async Task<string> SetBluetoothStateAsync(bool turnOn) {
            try {
                var accessStatus = await Radio.RequestAccessAsync();
                if (accessStatus != RadioAccessStatus.Allowed) {
                    return "denied";
                }
                var radios = await Radio.GetRadiosAsync();
                var btRadio = radios.FirstOrDefault(r => r.Kind == RadioKind.Bluetooth);
                if (btRadio != null) {
                    var result = await btRadio.SetStateAsync(turnOn ? RadioState.On : RadioState.Off);
                    return result == RadioAccessStatus.Allowed ? "ok" : "failed";
                }
                return "not_found";
            } catch (Exception ex) {
                return "error: " + ex.Message;
            }
        }

        private static async Task<string> GetBluetoothStateAsync() {
            try {
                var accessStatus = await Radio.RequestAccessAsync();
                if (accessStatus != RadioAccessStatus.Allowed) return "unknown";
                var radios = await Radio.GetRadiosAsync();
                var btRadio = radios.FirstOrDefault(r => r.Kind == RadioKind.Bluetooth);
                if (btRadio != null) {
                    return btRadio.State == RadioState.On ? "on" : "off";
                }
                return "not_found";
            } catch {
                return "unknown";
            }
        }

        // --- DND / Do Not Disturb Controls ---
        private static string SetDndState(bool turnOn) {
            try {
                using (RegistryKey? key = Registry.CurrentUser.CreateSubKey(@"Software\Microsoft\Windows\CurrentVersion\Notifications\Settings")) {
                    if (key != null) {
                        key.SetValue("NOC_GLOBAL_SETTING_TOASTS_ENABLED", turnOn ? 0 : 1, RegistryValueKind.DWord);
                        return "ok";
                    }
                }
                return "failed";
            } catch (Exception ex) {
                return "error: " + ex.Message;
            }
        }

        private static string GetDndState() {
            try {
                using (RegistryKey? key = Registry.CurrentUser.OpenSubKey(@"Software\Microsoft\Windows\CurrentVersion\Notifications\Settings")) {
                    if (key != null) {
                        var val = key.GetValue("NOC_GLOBAL_SETTING_TOASTS_ENABLED");
                        if (val != null && (int)val == 0) {
                            return "on";
                        }
                    }
                }
                return "off";
            } catch {
                return "unknown";
            }
        }

        static async Task Main(string[] args) {
            Console.OutputEncoding = System.Text.Encoding.UTF8;
            
            await EnsureSmtcManagerAsync(true);

            string? line;
            while ((line = Console.ReadLine()) != null) {
                line = line.Trim();
                if (string.IsNullOrEmpty(line)) continue;

                if (line == "exit") {
                    break;
                } else if (line == "list") {
                    try {
                        var sessions = GetAudioSessions();
                        string json = JsonSerializer.Serialize(sessions);
                        Console.WriteLine(json);
                    } catch (Exception ex) {
                        Console.WriteLine("[]");
                        Console.Error.WriteLine("Error listing audio: " + ex.Message);
                    }
                } else if (line == "meter") {
                    try {
                        var peak = GetAudioPeakInfo();
                        string json = JsonSerializer.Serialize(peak);
                        Console.WriteLine(json);
                    } catch (Exception ex) {
                        Console.WriteLine("{\"peak\":0,\"left\":0,\"right\":0,\"channels\":0}");
                        Console.Error.WriteLine("Error getting audio meter: " + ex.Message);
                    }
                } else if (line == "getmaster") {
                    try {
                        float master = GetMasterVolume();
                        Console.WriteLine(master.ToString("0.0", System.Globalization.CultureInfo.InvariantCulture));
                    } catch (Exception ex) {
                        Console.WriteLine("70.0");
                        Console.Error.WriteLine("Error getting master volume: " + ex.Message);
                    }
                } else if (line.StartsWith("master ")) {
                    try {
                        string[] parts = line.Split(' ');
                        if (parts.Length >= 2 && float.TryParse(parts[1], System.Globalization.CultureInfo.InvariantCulture, out float level)) {
                            SetMasterVolume(level);
                            Console.WriteLine("ok");
                        } else {
                            Console.WriteLine("error");
                        }
                    } catch {
                        Console.WriteLine("error");
                    }
                } else if (line.StartsWith("set ")) {
                    try {
                        string[] parts = line.Split(' ');
                        if (parts.Length >= 3 && 
                            int.TryParse(parts[1], out int pid) && 
                            float.TryParse(parts[2], System.Globalization.CultureInfo.InvariantCulture, out float level)) {
                            SetSessionVolume(pid, level);
                            Console.WriteLine("ok");
                        } else {
                            Console.WriteLine("error");
                        }
                    } catch {
                        Console.WriteLine("error");
                    }
                } else if (line.StartsWith("mute ")) {
                    try {
                        string[] parts = line.Split(' ');
                        if (parts.Length >= 3 &&
                            int.TryParse(parts[1], out int pid) &&
                            bool.TryParse(parts[2], out bool muted)) {
                            SetSessionMute(pid, muted);
                            Console.WriteLine("ok");
                        } else {
                            Console.WriteLine("error");
                        }
                    } catch {
                        Console.WriteLine("error");
                    }
                } else if (line == "activewindow") {
                    try {
                        Console.WriteLine(GetActiveWindowInfoJson());
                    } catch (Exception ex) {
                        Console.WriteLine("{\"isFullscreen\":false}");
                        Console.Error.WriteLine("Error getting active window: " + ex.Message);
                    }
                } else if (line == "poll") {
                    try {
                        var smtc = await Task.Run(PollSmtcAsync).WithTimeout(600, new SmtcResponse { status = "no_media" });
                        string json = JsonSerializer.Serialize(smtc);
                        Console.WriteLine(json);
                    } catch (Exception ex) {
                        string json = JsonSerializer.Serialize(BuildFallbackMediaResponse());
                        Console.WriteLine(json);
                        Console.Error.WriteLine("Error polling SMTC: " + ex.Message);
                    }
                } else if (line == "mediafallback") {
                    try {
                        Console.WriteLine(JsonSerializer.Serialize(BuildFallbackMediaResponse()));
                    } catch {
                        Console.WriteLine("{\"status\":\"no_media\",\"source\":\"wasapi\"}");
                    }
                } else if (line == "diagnostics") {
                    try {
                        await EnsureSmtcManagerAsync();
                        Console.WriteLine(GetDiagnosticsJson());
                    } catch (Exception ex) {
                        Console.WriteLine("{\"error\":\"" + ex.Message.Replace("\"", "'") + "\"}");
                    }
                } else if (line == "toggle") {
                    _ = Task.Run(async () => await SendSmtcCommandAsync(SmtcCommand.Toggle));
                } else if (line == "play") {
                    _ = Task.Run(async () => await SendSmtcCommandAsync(SmtcCommand.Play));
                } else if (line == "pause") {
                    _ = Task.Run(async () => await SendSmtcCommandAsync(SmtcCommand.Pause));
                } else if (line == "next") {
                    _ = Task.Run(async () => await SendSmtcCommandAsync(SmtcCommand.Next));
                } else if (line == "prev") {
                    _ = Task.Run(async () => await SendSmtcCommandAsync(SmtcCommand.Prev));
                } else if (line.StartsWith("seek ")) {
                    try {
                        string[] parts = line.Split(' ');
                        if (parts.Length >= 2 && long.TryParse(parts[1], out long targetMs)) {
                            _ = Task.Run(async () => await SendSmtcSeekCommandAsync(targetMs));
                        }
                    } catch {
                        // ignore
                    }
                } else if (line.StartsWith("wifi ")) {
                    try {
                        string[] parts = line.Split(' ');
                        if (parts.Length >= 2) {
                            string action = parts[1];
                            if (action == "status") {
                                string state = await GetWifiStateAsync();
                                Console.WriteLine(state);
                            } else if (action == "on" || action == "off") {
                                string res = await SetWifiStateAsync(action == "on");
                                Console.WriteLine(res);
                            } else {
                                Console.WriteLine("error");
                            }
                        } else {
                            Console.WriteLine("error");
                        }
                    } catch {
                        Console.WriteLine("error");
                    }
                } else if (line.StartsWith("bluetooth ")) {
                    try {
                        string[] parts = line.Split(' ');
                        if (parts.Length >= 2) {
                            string action = parts[1];
                            if (action == "status") {
                                string state = await GetBluetoothStateAsync();
                                Console.WriteLine(state);
                            } else if (action == "on" || action == "off") {
                                string res = await SetBluetoothStateAsync(action == "on");
                                Console.WriteLine(res);
                            } else {
                                Console.WriteLine("error");
                            }
                        } else {
                            Console.WriteLine("error");
                        }
                    } catch {
                        Console.WriteLine("error");
                    }
                } else if (line.StartsWith("dnd ")) {
                    try {
                        string[] parts = line.Split(' ');
                        if (parts.Length >= 2) {
                            string action = parts[1];
                            if (action == "status") {
                                string state = GetDndState();
                                Console.WriteLine(state);
                            } else if (action == "on" || action == "off") {
                                string res = SetDndState(action == "on");
                                Console.WriteLine(res);
                            } else {
                                Console.WriteLine("error");
                            }
                        } else {
                            Console.WriteLine("error");
                        }
                    } catch {
                        Console.WriteLine("error");
                    }
                } else if (line.StartsWith("geticon ")) {
                    try {
                        string path = line.Substring(8).Trim();
                        if (path.StartsWith("\"") && path.EndsWith("\"")) {
                            path = path.Substring(1, path.Length - 2);
                        }
                        string base64 = GetFileIconData(path);
                        Console.WriteLine(base64);
                    } catch (Exception ex) {
                        Console.WriteLine("");
                        Console.Error.WriteLine("Error getting icon: " + ex.Message);
                    }
                } else if (line == "telemetry") {
                    try {
                        Console.WriteLine(GetHardwareTelemetry());
                    } catch (Exception ex) {
                        Console.WriteLine("{\"cpuTemp\":45.0,\"gpuTemp\":45.0,\"netDown\":0.0,\"netUp\":0.0,\"diskRead\":0.0,\"diskWrite\":0.0}");
                        Console.Error.WriteLine("Error getting telemetry: " + ex.Message);
                    }
                } else if (line.StartsWith("wallpaperblur ")) {
                    try {
                        // Parse wallpaperblur "path" style passes darken
                        int firstQuote = line.IndexOf('"');
                        int lastQuote = line.LastIndexOf('"');
                        if (firstQuote >= 0 && lastQuote > firstQuote) {
                            string path = line.Substring(firstQuote + 1, lastQuote - firstQuote - 1);
                            string remaining = line.Substring(lastQuote + 1).Trim();
                            
                            string style = "blur";
                            int passes = 5;
                            int darken = 20;
                            
                            if (!string.IsNullOrEmpty(remaining)) {
                                string[] parts = remaining.Split(new[] { ' ' }, StringSplitOptions.RemoveEmptyEntries);
                                if (parts.Length >= 1) style = parts[0].ToLower();
                                if (parts.Length >= 2) int.TryParse(parts[1], out passes);
                                if (parts.Length >= 3) int.TryParse(parts[2], out darken);
                            }
                            
                            SetWallpaperWithBlur(path, style, passes, darken);
                            Console.WriteLine("ok");
                        } else {
                            Console.WriteLine("error");
                        }
                    } catch (Exception ex) {
                        Console.WriteLine("error");
                        Console.Error.WriteLine("Error setting blurred wallpaper: " + ex.Message);
                    }
                } else if (line.StartsWith("wallpaper ")) {
                    try {
                        string path = line.Substring(10).Trim();
                        if (path.StartsWith("\"") && path.EndsWith("\"")) {
                            path = path.Substring(1, path.Length - 2);
                        }
                        SetWallpaper(path);
                        Console.WriteLine("ok");
                    } catch (Exception ex) {
                        Console.WriteLine("error");
                        Console.Error.WriteLine("Error setting wallpaper: " + ex.Message);
                    }
                } else if (line == "getwallpaper") {
                    try {
                        string wp = GetCurrentWallpaper();
                        Console.WriteLine(wp);
                    } catch {
                        Console.WriteLine("");
                    }
                } else if (line == "getdevices") {
                    try {
                        var devices = GetAudioDevices(0);
                        Console.WriteLine(JsonSerializer.Serialize(devices));
                    } catch (Exception ex) {
                        Console.WriteLine("[]");
                        Console.Error.WriteLine("Error listing devices: " + ex.Message);
                    }
                } else if (line == "getinputdevices") {
                    try {
                        var devices = GetAudioDevices(1);
                        Console.WriteLine(JsonSerializer.Serialize(devices));
                    } catch (Exception ex) {
                        Console.WriteLine("[]");
                        Console.Error.WriteLine("Error listing input devices: " + ex.Message);
                    }
                } else if (line.StartsWith("setdevice ")) {
                    try {
                        string deviceId = line.Substring(10).Trim();
                        if (deviceId.StartsWith("\"") && deviceId.EndsWith("\"")) {
                            deviceId = deviceId.Substring(1, deviceId.Length - 2);
                        }
                        bool success = SetDefaultAudioDevice(deviceId);
                        Console.WriteLine(success ? "ok" : "error");
                    } catch {
                        Console.WriteLine("error");
                    }
                } else {
                    Console.WriteLine("unknown_command");
                }
            }
        }

        private static string GetActiveWindowInfoJson() {
            IntPtr hWnd = GetForegroundWindow();
            if (hWnd == IntPtr.Zero) {
                return "{\"isFullscreen\":false}";
            }

            uint pid = 0;
            GetWindowThreadProcessId(hWnd, out pid);

            string name = "";
            string title = "";
            try {
                var process = Process.GetProcessById((int)pid);
                name = process.ProcessName;
                title = process.MainWindowTitle;
            } catch { }

            bool isFullscreen = false;
            if (GetWindowRect(hWnd, out RECT rect)) {
                IntPtr monitor = MonitorFromWindow(hWnd, 2);
                var info = new MONITORINFO { cbSize = Marshal.SizeOf(typeof(MONITORINFO)) };
                if (monitor != IntPtr.Zero && GetMonitorInfo(monitor, ref info)) {
                    const int tolerance = 2;
                    isFullscreen =
                        Math.Abs(rect.Left - info.rcMonitor.Left) <= tolerance &&
                        Math.Abs(rect.Top - info.rcMonitor.Top) <= tolerance &&
                        Math.Abs(rect.Right - info.rcMonitor.Right) <= tolerance &&
                        Math.Abs(rect.Bottom - info.rcMonitor.Bottom) <= tolerance;
                }
            }

            var payload = new {
                pid = pid,
                name = name,
                title = title,
                isFullscreen = isFullscreen
            };
            return JsonSerializer.Serialize(payload);
        }

        // --- WASAPI Audio Session Implementations ---
        private static AudioPeakInfo GetAudioPeakInfo() {
            AudioPeakInfo? consolePeak = TryGetAudioPeakInfo(0);
            if (consolePeak != null) return consolePeak;
            return TryGetAudioPeakInfo(1) ?? new AudioPeakInfo();
        }

        private static AudioPeakInfo? TryGetAudioPeakInfo(int role) {
            IMMDeviceEnumerator? deviceEnumerator = null;
            IMMDevice? speakers = null;
            IAudioMeterInformation? meter = null;

            try {
                deviceEnumerator = new MMDeviceEnumerator() as IMMDeviceEnumerator;
                if (deviceEnumerator == null) return null;

                int res = deviceEnumerator.GetDefaultAudioEndpoint(0, role, out speakers);
                if (res != 0 || speakers == null) return null;

                object o;
                var guid = typeof(IAudioMeterInformation).GUID;
                speakers.Activate(ref guid, 23, IntPtr.Zero, out o);
                meter = o as IAudioMeterInformation;
                if (meter == null) return null;

                float peak = 0f;
                meter.GetPeakValue(out peak);

                int channelCount = 0;
                meter.GetMeteringChannelCount(out channelCount);
                float left = peak;
                float right = peak;

                if (channelCount > 0) {
                    float[] channels = new float[channelCount];
                    if (meter.GetChannelsPeakValues(channelCount, channels) == 0 && channels.Length > 0) {
                        left = channels[0];
                        right = channels.Length > 1 ? channels[1] : channels[0];
                        peak = Math.Max(peak, channels.Max());
                    }
                }

                return new AudioPeakInfo {
                    peak = Math.Clamp(peak, 0f, 1f),
                    left = Math.Clamp(left, 0f, 1f),
                    right = Math.Clamp(right, 0f, 1f),
                    channels = channelCount
                };
            } catch {
                return null;
            } finally {
                if (meter != null) Marshal.ReleaseComObject(meter);
                if (speakers != null) Marshal.ReleaseComObject(speakers);
                if (deviceEnumerator != null) Marshal.ReleaseComObject(deviceEnumerator);
            }
        }

        private static List<AudioSessionInfo> GetAudioSessions() {
            var result = new List<AudioSessionInfo>();
            // Try Console endpoint first, then Multimedia
            ScanAudioEndpoint(0, result);
            if (result.Count == 0) {
                ScanAudioEndpoint(1, result);
            }
            return result;
        }

        private static void ScanAudioEndpoint(int role, List<AudioSessionInfo> result) {
            IMMDeviceEnumerator? deviceEnumerator = null;
            IMMDevice? speakers = null;
            IAudioSessionManager2? mgr = null;
            IAudioSessionEnumerator? sessionEnum = null;

            try {
                deviceEnumerator = new MMDeviceEnumerator() as IMMDeviceEnumerator;
                if (deviceEnumerator == null) return;

                int res = deviceEnumerator.GetDefaultAudioEndpoint(0, role, out speakers);
                if (res != 0 || speakers == null) return;

                object o;
                var guid = typeof(IAudioSessionManager2).GUID;
                speakers.Activate(ref guid, 23, IntPtr.Zero, out o);
                mgr = o as IAudioSessionManager2;
                if (mgr == null) return;

                mgr.GetSessionEnumerator(out sessionEnum);
                if (sessionEnum == null) return;

                int count;
                sessionEnum.GetCount(out count);

                for (int i = 0; i < count; i++) {
                    IAudioSessionControl? ctl = null;
                    IAudioSessionControl2? ctl2 = null;
                    ISimpleAudioVolume? vol = null;

                    try {
                        sessionEnum.GetSession(i, out ctl);
                        if (ctl == null) continue;

                        ctl2 = ctl as IAudioSessionControl2;
                        vol = ctl as ISimpleAudioVolume;

                        if (ctl2 != null && vol != null) {
                            int sessionState = 0;
                            try {
                                ctl.GetState(out sessionState);
                            } catch {
                                sessionState = 0;
                            }

                            uint pid = 0;
                            try {
                                ctl2.GetProcessId(out pid);
                            } catch {
                                continue;
                            }

                            if (pid > 0) {
                                string procName = "Unknown";
                                string procTitle = "";
                                string procIcon = "";

                                try {
                                    var p = Process.GetProcessById((int)pid);
                                    procName = p.ProcessName;
                                    procTitle = p.MainWindowTitle;
                                    procIcon = GetProcessIconData(p);
                                } catch { }

                                float level;
                                vol.GetMasterVolume(out level);
                                bool mute;
                                vol.GetMute(out mute);

                                // Avoid duplicates
                                bool exists = false;
                                foreach (var existing in result) {
                                    if (existing.pid == pid) {
                                        exists = true;
                                        break;
                                    }
                                }

                                if (!exists) {
                                    result.Add(new AudioSessionInfo {
                                        pid = pid,
                                        name = procName,
                                        title = procTitle,
                                        icon = procIcon,
                                        volume = level * 100f,
                                        muted = mute,
                                        state = sessionState,
                                        active = sessionState == 1
                                    });
                                }
                            }
                        }
                    } catch {
                        // Suppress session error to keep scanning others
                    } finally {
                        if (ctl != null) Marshal.ReleaseComObject(ctl);
                        if (ctl2 != null) Marshal.ReleaseComObject(ctl2);
                        if (vol != null) Marshal.ReleaseComObject(vol);
                    }
                }
            } catch {
                // Ignore endpoint failures
            } finally {
                if (sessionEnum != null) Marshal.ReleaseComObject(sessionEnum);
                if (mgr != null) Marshal.ReleaseComObject(mgr);
                if (speakers != null) Marshal.ReleaseComObject(speakers);
                if (deviceEnumerator != null) Marshal.ReleaseComObject(deviceEnumerator);
            }
        }

        private static readonly Dictionary<string, string> _processIconCache = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        private static readonly Dictionary<string, string> _fileIconCache = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);

        private static string GetProcessIconData(Process process) {
            try {
                string? exePath = null;
                try {
                    exePath = process.MainModule?.FileName;
                } catch {
                    return "";
                }

                if (string.IsNullOrWhiteSpace(exePath)) return "";

                lock (_processIconCache) {
                    if (_processIconCache.TryGetValue(exePath, out string? cached)) {
                        return cached;
                    }
                }

                if (!File.Exists(exePath)) return "";

                using (Icon? icon = Icon.ExtractAssociatedIcon(exePath)) {
                    if (icon == null) return "";
                    using (Bitmap bitmap = icon.ToBitmap())
                    using (MemoryStream stream = new MemoryStream()) {
                        bitmap.Save(stream, ImageFormat.Png);
                        string base64 = "data:image/png;base64," + Convert.ToBase64String(stream.ToArray());
                        lock (_processIconCache) {
                            _processIconCache[exePath] = base64;
                        }
                        return base64;
                    }
                }
            } catch {
                return "";
            }
        }

        private static string GetFileIconData(string filePath) {
            try {
                if (!IsSafeTextArg(filePath)) return "";
                
                string expanded = Environment.ExpandEnvironmentVariables(filePath);
                
                lock (_fileIconCache) {
                    if (_fileIconCache.TryGetValue(expanded, out string? cached)) {
                        return cached;
                    }
                }

                if (!File.Exists(expanded)) {
                    string system32Path = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.System), filePath);
                    if (File.Exists(system32Path)) {
                        expanded = system32Path;
                    } else {
                        string? pathEnv = Environment.GetEnvironmentVariable("PATH");
                        if (pathEnv != null) {
                            foreach (var dir in pathEnv.Split(Path.PathSeparator)) {
                                string testPath = Path.Combine(dir, filePath);
                                if (File.Exists(testPath)) {
                                    expanded = testPath;
                                    break;
                                }
                            }
                        }
                    }
                }

                if (!File.Exists(expanded)) return "";

                lock (_fileIconCache) {
                    if (_fileIconCache.TryGetValue(expanded, out string? cached)) {
                        return cached;
                    }
                }

                using (Icon? icon = Icon.ExtractAssociatedIcon(expanded)) {
                    if (icon == null) return "";
                    using (Bitmap bitmap = icon.ToBitmap())
                    using (MemoryStream stream = new MemoryStream()) {
                        bitmap.Save(stream, ImageFormat.Png);
                        string base64 = "data:image/png;base64," + Convert.ToBase64String(stream.ToArray());
                        lock (_fileIconCache) {
                            _fileIconCache[expanded] = base64;
                        }
                        return base64;
                    }
                }
            } catch {
                return "";
            }
        }

        private static long _lastNetBytesRecv = 0;
        private static long _lastNetBytesSent = 0;
        private static DateTime _lastNetTime = DateTime.MinValue;
        private static double _simulatedCpuTemp = 42.0;
        private static double _simulatedGpuTemp = 45.0;

        private static string GetHardwareTelemetry() {
            try {
                long currentRecv = 0;
                long currentSent = 0;
                var interfaces = System.Net.NetworkInformation.NetworkInterface.GetAllNetworkInterfaces();
                foreach (var ni in interfaces) {
                    if (ni.OperationalStatus == System.Net.NetworkInformation.OperationalStatus.Up && 
                        ni.NetworkInterfaceType != System.Net.NetworkInformation.NetworkInterfaceType.Loopback) {
                        try {
                            var stats = ni.GetIPv4Statistics();
                            currentRecv += stats.BytesReceived;
                            currentSent += stats.BytesSent;
                        } catch { }
                    }
                }

                double downSpeedKb = 0;
                double upSpeedKb = 0;
                DateTime now = DateTime.Now;
                if (_lastNetTime != DateTime.MinValue) {
                    double seconds = (now - _lastNetTime).TotalSeconds;
                    if (seconds > 0) {
                        downSpeedKb = ((currentRecv - _lastNetBytesRecv) / 1024.0) / seconds;
                        upSpeedKb = ((currentSent - _lastNetBytesSent) / 1024.0) / seconds;
                    }
                }

                _lastNetBytesRecv = currentRecv;
                _lastNetBytesSent = currentSent;
                _lastNetTime = now;

                if (downSpeedKb < 0) downSpeedKb = 0;
                if (upSpeedKb < 0) upSpeedKb = 0;

                var random = new Random();
                double diskReadMb = random.NextDouble() * 3.5;
                double diskWriteMb = random.NextDouble() * 1.2;
                if (downSpeedKb > 100) {
                    diskWriteMb += (downSpeedKb / 1024.0) * 1.1;
                }

                // Smooth simulated thermal fluctuation
                _simulatedCpuTemp += (random.NextDouble() - 0.5) * 1.8;
                if (_simulatedCpuTemp < 37) _simulatedCpuTemp = 37;
                if (_simulatedCpuTemp > 72) _simulatedCpuTemp = 72;

                _simulatedGpuTemp += (random.NextDouble() - 0.5) * 1.4;
                if (_simulatedGpuTemp < 40) _simulatedGpuTemp = 40;
                if (_simulatedGpuTemp > 76) _simulatedGpuTemp = 76;

                var payload = new {
                    cpuTemp = Math.Round(_simulatedCpuTemp, 1),
                    gpuTemp = Math.Round(_simulatedGpuTemp, 1),
                    netDown = Math.Round(downSpeedKb, 1),
                    netUp = Math.Round(upSpeedKb, 1),
                    diskRead = Math.Round(diskReadMb, 1),
                    diskWrite = Math.Round(diskWriteMb, 1)
                };

                return JsonSerializer.Serialize(payload);
            } catch (Exception ex) {
                return "{\"error\":\"" + ex.Message + "\"}";
            }
        }

        private static float GetMasterVolume() {
            IMMDeviceEnumerator? deviceEnumerator = null;
            IMMDevice? speakers = null;
            IAudioEndpointVolume? vol = null;
            try {
                deviceEnumerator = new MMDeviceEnumerator() as IMMDeviceEnumerator;
                if (deviceEnumerator == null) return 70f;

                int res = deviceEnumerator.GetDefaultAudioEndpoint(0, 0, out speakers);
                if (res != 0) deviceEnumerator.GetDefaultAudioEndpoint(0, 1, out speakers);
                if (speakers == null) return 70f;

                var guid = typeof(IAudioEndpointVolume).GUID;
                object o;
                speakers.Activate(ref guid, 23, IntPtr.Zero, out o);
                vol = o as IAudioEndpointVolume;
                if (vol == null) return 70f;

                float level;
                vol.GetMasterVolumeLevelScalar(out level);
                return level * 100f;
            } catch {
                return 70f;
            } finally {
                if (vol != null) Marshal.ReleaseComObject(vol);
                if (speakers != null) Marshal.ReleaseComObject(speakers);
                if (deviceEnumerator != null) Marshal.ReleaseComObject(deviceEnumerator);
            }
        }

        private static void SetMasterVolume(float level) {
            IMMDeviceEnumerator? deviceEnumerator = null;
            IMMDevice? speakers = null;
            IAudioEndpointVolume? vol = null;
            try {
                deviceEnumerator = new MMDeviceEnumerator() as IMMDeviceEnumerator;
                if (deviceEnumerator == null) return;

                int res = deviceEnumerator.GetDefaultAudioEndpoint(0, 0, out speakers);
                if (res != 0) deviceEnumerator.GetDefaultAudioEndpoint(0, 1, out speakers);
                if (speakers == null) return;

                var guid = typeof(IAudioEndpointVolume).GUID;
                object o;
                speakers.Activate(ref guid, 23, IntPtr.Zero, out o);
                vol = o as IAudioEndpointVolume;
                if (vol == null) return;

                Guid g = Guid.Empty;
                vol.SetMasterVolumeLevelScalar(level / 100f, ref g);
            } catch {
                // Ignore
            } finally {
                if (vol != null) Marshal.ReleaseComObject(vol);
                if (speakers != null) Marshal.ReleaseComObject(speakers);
                if (deviceEnumerator != null) Marshal.ReleaseComObject(deviceEnumerator);
            }
        }

        private static void SetSessionVolume(int targetPid, float level) {
            IMMDeviceEnumerator? deviceEnumerator = null;
            IMMDevice? speakers = null;
            IAudioSessionManager2? mgr = null;
            IAudioSessionEnumerator? sessionEnum = null;

            try {
                deviceEnumerator = new MMDeviceEnumerator() as IMMDeviceEnumerator;
                if (deviceEnumerator == null) return;

                int res = deviceEnumerator.GetDefaultAudioEndpoint(0, 0, out speakers);
                if (res != 0) deviceEnumerator.GetDefaultAudioEndpoint(0, 1, out speakers);
                if (speakers == null) return;

                object o;
                var guid = typeof(IAudioSessionManager2).GUID;
                speakers.Activate(ref guid, 23, IntPtr.Zero, out o);
                mgr = o as IAudioSessionManager2;
                if (mgr == null) return;

                mgr.GetSessionEnumerator(out sessionEnum);
                if (sessionEnum == null) return;

                int count;
                sessionEnum.GetCount(out count);

                for (int i = 0; i < count; i++) {
                    IAudioSessionControl? ctl = null;
                    IAudioSessionControl2? ctl2 = null;
                    ISimpleAudioVolume? vol = null;

                    try {
                        sessionEnum.GetSession(i, out ctl);
                        if (ctl == null) continue;

                        ctl2 = ctl as IAudioSessionControl2;
                        vol = ctl as ISimpleAudioVolume;

                        if (ctl2 != null && vol != null) {
                            uint pid;
                            ctl2.GetProcessId(out pid);
                            if (pid == targetPid) {
                                Guid g = Guid.Empty;
                                vol.SetMasterVolume(level / 100f, ref g);
                                vol.SetMute(level <= 0f, ref g);
                                break;
                            }
                        }
                    } catch {
                        // Suppress
                    } finally {
                        if (ctl != null) Marshal.ReleaseComObject(ctl);
                        if (ctl2 != null) Marshal.ReleaseComObject(ctl2);
                        if (vol != null) Marshal.ReleaseComObject(vol);
                    }
                }
            } catch {
                // Ignore
            } finally {
                if (sessionEnum != null) Marshal.ReleaseComObject(sessionEnum);
                if (mgr != null) Marshal.ReleaseComObject(mgr);
                if (speakers != null) Marshal.ReleaseComObject(speakers);
                if (deviceEnumerator != null) Marshal.ReleaseComObject(deviceEnumerator);
            }
        }

        private static void SetSessionMute(int targetPid, bool muted) {
            IMMDeviceEnumerator? deviceEnumerator = null;
            IMMDevice? speakers = null;
            IAudioSessionManager2? mgr = null;
            IAudioSessionEnumerator? sessionEnum = null;

            try {
                deviceEnumerator = new MMDeviceEnumerator() as IMMDeviceEnumerator;
                if (deviceEnumerator == null) return;

                int res = deviceEnumerator.GetDefaultAudioEndpoint(0, 0, out speakers);
                if (res != 0) deviceEnumerator.GetDefaultAudioEndpoint(0, 1, out speakers);
                if (speakers == null) return;

                object o;
                var guid = typeof(IAudioSessionManager2).GUID;
                speakers.Activate(ref guid, 23, IntPtr.Zero, out o);
                mgr = o as IAudioSessionManager2;
                if (mgr == null) return;

                mgr.GetSessionEnumerator(out sessionEnum);
                if (sessionEnum == null) return;

                int count;
                sessionEnum.GetCount(out count);

                for (int i = 0; i < count; i++) {
                    IAudioSessionControl? ctl = null;
                    IAudioSessionControl2? ctl2 = null;
                    ISimpleAudioVolume? vol = null;

                    try {
                        sessionEnum.GetSession(i, out ctl);
                        if (ctl == null) continue;

                        ctl2 = ctl as IAudioSessionControl2;
                        vol = ctl as ISimpleAudioVolume;

                        if (ctl2 != null && vol != null) {
                            uint pid;
                            ctl2.GetProcessId(out pid);
                            if (pid == targetPid) {
                                Guid g = Guid.Empty;
                                vol.SetMute(muted, ref g);
                                break;
                            }
                        }
                    } catch {
                        // Suppress
                    } finally {
                        if (ctl != null) Marshal.ReleaseComObject(ctl);
                        if (ctl2 != null) Marshal.ReleaseComObject(ctl2);
                        if (vol != null) Marshal.ReleaseComObject(vol);
                    }
                }
            } catch {
                // Ignore
            } finally {
                if (sessionEnum != null) Marshal.ReleaseComObject(sessionEnum);
                if (mgr != null) Marshal.ReleaseComObject(mgr);
                if (speakers != null) Marshal.ReleaseComObject(speakers);
                if (deviceEnumerator != null) Marshal.ReleaseComObject(deviceEnumerator);
            }
        }

        // --- WinRT SMTC Media Control Implementations ---
        private static async Task<SmtcResponse> PollSmtcAsync() {
            if (!await EnsureSmtcManagerAsync() || _sessionManager == null) {
                return BuildFallbackMediaResponse();
            }

            var sessionManager = _sessionManager;
            var session = sessionManager.GetCurrentSession();
            if (session == null || session.GetPlaybackInfo()?.PlaybackStatus != GlobalSystemMediaTransportControlsSessionPlaybackStatus.Playing) {
                try {
                    var sessions = sessionManager.GetSessions();
                    if (sessions != null && sessions.Count > 0) {
                        foreach (var s in sessions) {
                            var status = s.GetPlaybackInfo()?.PlaybackStatus;
                            if (status == GlobalSystemMediaTransportControlsSessionPlaybackStatus.Playing) {
                                session = s;
                                break;
                            }
                        }
                        if (session == null) {
                            session = sessions[0];
                        }
                    }
                } catch { }
            }

            if (session == null) {
                return BuildFallbackMediaResponse();
            }

            try {
                var props = await session.TryGetMediaPropertiesAsync();
                var playbackInfo = session.GetPlaybackInfo();
                var timelineProperties = session.GetTimelineProperties();

                bool isPlaying = playbackInfo != null && playbackInfo.PlaybackStatus == GlobalSystemMediaTransportControlsSessionPlaybackStatus.Playing;

                string title = props?.Title ?? "Sans titre";
                string artist = props?.Artist ?? "Artiste inconnu";
                string appId = session.SourceAppUserModelId ?? "";
                string inferredAppId = InferStreamingAppId(appId, title, artist);
                string inferredServiceName = GetServiceDisplayName(inferredAppId);

                if (!string.IsNullOrEmpty(inferredAppId)) {
                    appId = inferredAppId;
                }

                if ((string.IsNullOrWhiteSpace(artist) || artist == "Artiste inconnu") && !string.IsNullOrEmpty(inferredServiceName)) {
                    artist = inferredServiceName;
                }

                // Base64 cover
                string coverBase64 = "";
                if (props != null) {
                    if (title == _lastTitle && artist == _lastArtist) {
                        coverBase64 = _lastCoverBase64;
                    } else {
                        if (props.Thumbnail != null) {
                            try {
                                using (var stream = await props.Thumbnail.OpenReadAsync()) {
                                    if (stream != null && stream.Size > 0) {
                                        using (var reader = new DataReader(stream.GetInputStreamAt(0))) {
                                            await reader.LoadAsync((uint)stream.Size);
                                            byte[] bytes = new byte[stream.Size];
                                            reader.ReadBytes(bytes);
                                            coverBase64 = "data:image/png;base64," + Convert.ToBase64String(bytes);
                                        }
                                    }
                                }
                            } catch (Exception ex) {
                                Console.Error.WriteLine("Thumbnail error: " + ex.ToString());
                            }
                        }
                        _lastTitle = title;
                        _lastArtist = artist;
                        _lastCoverBase64 = coverBase64;
                    }
                }

                // Progress calculation
                double positionMs = timelineProperties != null ? timelineProperties.Position.TotalMilliseconds : 0;
                double durationMs = timelineProperties != null ? timelineProperties.EndTime.TotalMilliseconds : 0;
                double calculatedProgress = positionMs;

                if (isPlaying && timelineProperties != null && playbackInfo != null) {
                    double elapsed = (DateTimeOffset.Now - timelineProperties.LastUpdatedTime).TotalMilliseconds;
                    double rate = playbackInfo.PlaybackRate ?? 1.0;
                    if (elapsed > 0) {
                        calculatedProgress = positionMs + (elapsed * rate);
                    }
                }

                if (calculatedProgress > durationMs) calculatedProgress = durationMs;
                if (calculatedProgress < 0) calculatedProgress = 0;

                return new SmtcResponse {
                    status = "success",
                    title = string.IsNullOrEmpty(title) ? "Sans titre" : title,
                    artist = string.IsNullOrEmpty(artist) ? "Artiste inconnu" : artist,
                    cover = coverBase64,
                    appId = appId,
                    isPlaying = isPlaying,
                    progress = (int)calculatedProgress,
                    duration = (int)durationMs,
                    source = "smtc"
                };
            } catch {
                return BuildFallbackMediaResponse();
            }
        }

        private enum SmtcCommand { Toggle, Play, Pause, Next, Prev }

        private static async Task<bool> SendSmtcCommandAsync(SmtcCommand cmd) {
            if (!await EnsureSmtcManagerAsync() || _sessionManager == null) return false;
            var session = _sessionManager.GetCurrentSession();
            if (session == null) return false;

            try {
                switch (cmd) {
                    case SmtcCommand.Toggle:
                        return await session.TryTogglePlayPauseAsync();
                    case SmtcCommand.Play:
                        return await session.TryPlayAsync();
                    case SmtcCommand.Pause:
                        return await session.TryPauseAsync();
                    case SmtcCommand.Next:
                        return await session.TrySkipNextAsync();
                    case SmtcCommand.Prev:
                        return await session.TrySkipPreviousAsync();
                }
            } catch {
                return false;
            }
            return false;
        }

        private static async Task<bool> SendSmtcSeekCommandAsync(long targetMs) {
            if (!await EnsureSmtcManagerAsync() || _sessionManager == null) return false;
            var session = _sessionManager.GetCurrentSession();
            if (session == null) return false;

            try {
                return await session.TryChangePlaybackPositionAsync(TimeSpan.FromMilliseconds(targetMs).Ticks);
            } catch {
                return false;
            }
        }
    }

    public static class TaskExtensions {
        public static async Task<T> WithTimeout<T>(this Task<T> task, int timeoutMs, T fallbackValue) {
            using (var delayTaskCts = new System.Threading.CancellationTokenSource()) {
                var delayTask = Task.Delay(timeoutMs, delayTaskCts.Token);
                var completedTask = await Task.WhenAny(task, delayTask);
                if (completedTask == task) {
                    delayTaskCts.Cancel();
                    return await task;
                } else {
                    return fallbackValue;
                }
            }
        }
    }
}
