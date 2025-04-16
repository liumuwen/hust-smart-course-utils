// ==UserScript==
// @name         hust智慧课堂心理健康刷课脚本
// @namespace    http://tampermonkey.net/
// @version      0.2
// @description  自动完成视频并跳转到下一节，可手动停止脚本运行
// @author       liumuwen
// @match        *://smartcourse.hust.edu.cn/mooc-smartcourse/mycourse/studentstudy*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function () {
    'use strict';

     /**
     * 参考资料：
     * - https://github.com/LiuziqiOvO/HUST-Course-Helper
     * - chatgpt
     * -
     */

    let enabled = true; // 是否启用刷课
    let lastUrl = location.href;
    let currentVideoUrl = '';
    let modifyTimer = null;
    let isInjecting = false;

    function safeSetTimeout(fn, delay) {
        if (modifyTimer) clearTimeout(modifyTimer);
        modifyTimer = setTimeout(fn, delay);
    }

    function autoCompleteVideo() {
        if (!enabled || isInjecting) return;

        const mainFrame = document.querySelector('#iframe');
        if (!mainFrame) {
            safeSetTimeout(autoCompleteVideo, 1000);
            return;
        }

        const videoFrame = mainFrame.contentWindow?.document.querySelector('iframe');
        if (!videoFrame) {
            safeSetTimeout(autoCompleteVideo, 1000);
            return;
        }

        const videoSrc = videoFrame.src;
        if (videoSrc === currentVideoUrl) {
            return; // 同一个视频不重复刷
        }

        currentVideoUrl = videoSrc;
        isInjecting = true;

        const videoWin = videoFrame.contentWindow;

        videoWin.eval(`
            function modifyPlayer() {
                if (typeof videojs === 'undefined' || !videojs.getAllPlayers().length) {
                    console.log('[刷课] 等待播放器加载...');
                    setTimeout(modifyPlayer, 1000);
                    return;
                }

                const player = videojs.getAllPlayers()[0];
                const duration = player.duration();

                if (!duration || isNaN(duration) || duration === Infinity) {
                    console.log('[刷课] duration 无效，继续等待...');
                    setTimeout(modifyPlayer, 1000);
                    return;
                }

                try {
                    console.log('[刷课] 播放器就绪，播放并完成...');
                    player.muted(true); // 静音
                    player.play();
                    player.currentTime(duration);
                    player.trigger('ended');

                    player.reportProgress = function() {
                        return {
                            completed: true,
                            duration: this.duration(),
                            position: this.duration()
                        };
                    };

                    if (typeof ed_complete === 'function') {
                        setTimeout(ed_complete, 1000);
                    }

                    console.log('[刷课] 视频处理完成！');

                    window.top.postMessage({ type: 'NEXT_VIDEO' }, '*');

                } catch (e) {
                    console.error('[刷课] 播放器控制失败：', e);
                }
            }
            modifyPlayer();
        `);

        setTimeout(() => {
            isInjecting = false;
        }, 3000); // 3秒后释放注入锁
    }

    function waitAndClickNextChapter() {
        if (!enabled) return;

        const doc = window.top.document;
        const popupBtn = doc.querySelector('.popBottom a.nextChapter');
        if (popupBtn) {
            console.log('[刷课] 弹框中点击下一节...');
            popupBtn.click();
            return;
        }

        const directBtn = doc.querySelector('#prevNextFocusNext');
        if (directBtn) {
            console.log('[刷课] 主页面点击下一节...');
            directBtn.click();
            return;
        }

        console.log('[刷课] “下一节”按钮未就绪，继续等待...');
        setTimeout(waitAndClickNextChapter, 1000);
    }

    // 接收 iframe 中视频完成的消息
    window.addEventListener('message', (event) => {
        if (event.data?.type === 'NEXT_VIDEO' && enabled) {
            console.log('[刷课] 视频完成，准备跳转下一节...');
            setTimeout(waitAndClickNextChapter, 5000); // 延迟跳转
        }
    });
        // 监听 iframe 内部播放按钮点击
    function waitForPlayButtonInIframe() {
        const mainFrame = document.querySelector('#iframe');
        if (!mainFrame) {
            setTimeout(waitForPlayButtonInIframe, 1000);
            return;
        }

        const videoFrame = mainFrame.contentWindow?.document.querySelector('iframe');
        if (!videoFrame) {
            setTimeout(waitForPlayButtonInIframe, 1000);
            return;
        }

        const videoDoc = videoFrame.contentDocument || videoFrame.contentWindow?.document;
        if (!videoDoc) {
            setTimeout(waitForPlayButtonInIframe, 1000);
            return;
        }

        const playBtn = videoDoc.querySelector('.vjs-big-play-button');
        if (playBtn) {
            playBtn.addEventListener('click', () => {
                console.log('[刷课] 播放按钮被点击，开始刷课...');
                autoCompleteVideo();
            });
            playBtn.click(); // 自动点击播放按钮

        } else {
            setTimeout(waitForPlayButtonInIframe, 1000);
        }

    }

    // 注册控制按钮
    function addControlButtons() {
        const container = document.createElement('div');
        container.style.position = 'fixed';
        container.style.top = '10px';
        container.style.right = '10px';
        container.style.zIndex = '9999';
        container.style.background = 'rgba(0,0,0,0.7)';
        container.style.color = '#fff';
        container.style.padding = '10px';
        container.style.borderRadius = '8px';
        container.style.fontSize = '14px';
        container.innerHTML = `
            <button id="startAuto" style="margin: 2px;color:green">开始</button>
            <button id="stopAuto" style="margin: 2px;color:red">停止</button>
        `;
        document.body.appendChild(container);
        document.getElementById('startAuto').addEventListener('click', () => {
            enabled = true;
            waitForPlayButtonInIframe();
            console.log('[刷课] 打开');
        });

        document.getElementById('stopAuto').addEventListener('click', () => {
            enabled = false;
            console.log('[刷课] 关闭');
        });
    }

    addControlButtons();
    waitForPlayButtonInIframe();

    // 监听地址栏变化
    new MutationObserver(() => {
        const url = location.href;
        if (url !== lastUrl) {
            lastUrl = url;
            currentVideoUrl = ''; // 重置，确保新视频能处理
            console.log('[刷课] 页面变化，尝试刷课...');
            waitForPlayButtonInIframe();
        }
    }).observe(document, { subtree: true, childList: true });
    
})();