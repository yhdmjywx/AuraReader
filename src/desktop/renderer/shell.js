// Resolve against the protocol entry rather than the source filesystem layout.
import(new URL('desktop.js', location.href).href).catch(error => {
    console.error('桌面入口加载失败', error);
    document.body.textContent = '桌面入口加载失败，请保留现有数据并重新安装应用。';
});
