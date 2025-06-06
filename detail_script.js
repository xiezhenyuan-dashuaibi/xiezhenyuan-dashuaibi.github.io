// 等待整个HTML文档加载和解析完成
document.addEventListener('DOMContentLoaded', () => {
    const articleContent = document.querySelector('.article-content');
    const articleToc = document.getElementById('article-toc');

    if (!articleContent || !articleToc) {
        console.error('找不到文章内容区域或目录区域!');
        return; // 如果必需的元素不存在，停止执行
    }

    // 1. 从 URL 获取要加载的 Markdown 文件名
    const urlParams = new URLSearchParams(window.location.search);
    const itemId = urlParams.get('item'); // 假设主页跳转链接是 detail.html?item=项目ID

    // 如果 URL 中没有 item 参数，或者 item 为空
    if (!itemId) {
        articleContent.innerHTML = '<p>错误：未指定要加载的项目详情。</p>';
        articleToc.innerHTML = '<p>无法生成目录。</p>';
        console.error('URL 中缺少 item 参数');
        return;
    }

    // 构建 Markdown 文件路径 (假设你的 markdown 文件都放在一个叫 'markdown' 的文件夹里)
    const markdownFilePath = `${itemId}.md`;

    // 2. 加载 Markdown 文件内容
    fetch(markdownFilePath)
        .then(response => {
            if (!response.ok) {
                // 如果响应状态码不是 2xx，抛出错误
                throw new Error(`无法加载文件: ${response.status} ${response.statusText}`);
            }
            return response.text(); // 获取文件内容为文本
        })
        .then(markdownText => {
            // 3. 使用 marked.js 将 Markdown 文本转换为 HTML
            // marked.setOptions({
            //     // marked.js 的可选配置，例如代码高亮
            //     highlight: function(code) {
            //         return hljs.highlightAuto(code).value;
            //     }
            // });
            const htmlContent = marked.parse(markdownText);

            // 将转换后的 HTML 插入到内容区域
            articleContent.innerHTML = htmlContent;

            // 4 & 5. 遍历标题并自动生成目录
            generateTableOfContents(articleContent, articleToc);

            // 6. 添加目录高亮功能
            setupTableOfContentsHighlighting(articleContent, articleToc);

        })
        .catch(error => {
            // 捕获加载或解析过程中的错误
            console.error('加载或解析 Markdown 失败:', error);
            articleContent.innerHTML = `<p>加载内容失败：${error.message}</p>`;
            articleToc.innerHTML = '<p>目录加载失败。</p>';
        });
});


/**
 * 根据内容区域的标题生成目录结构
 * @param {HTMLElement} contentElement - 包含文章内容的元素
 * @param {HTMLElement} tocElement - 插入目录的元素
 */
function generateTableOfContents(contentElement, tocElement) {
    // 移除旧的加载提示或内容
    tocElement.innerHTML = '';

    // 查找内容区域所有的 H2 到 H6 标题 (通常 H1 是文章主标题，不包含在目录)
    const headings = contentElement.querySelectorAll('h2, h3, h4, h5, h6');

    if (headings.length === 0) {
        tocElement.innerHTML = '<p>无可用目录。</p>';
        return;
    }

    // 创建目录的根 ul 元素
    const rootUl = document.createElement('ul');
    rootUl.classList.add('toc-list'); // 可以添加一个类方便 CSS 样式

    // 维护当前层级的 ul 元素和层级栈
    let currentUl = rootUl;
    const ulStack = [rootUl]; // 栈顶是当前要添加li的ul
    const levelStack = [1]; // 栈顶是当前ul对应的父级标题级别 (rootUl的父级视为级别1)
    const usedIds = new Set(); // 用于确保生成的ID在本轮目录生成中是唯一的

    headings.forEach(heading => {
        // 获取标题文本
        const headingText = heading.textContent.trim();
        // 获取标题级别 (例如 'H2' -> 2)
        const headingLevel = parseInt(heading.tagName.substring(1));

        // 为标题生成或获取 ID，用于锚点链接
        if (!heading.id) {
            let baseId = slugify(headingText); // 使用 slugify 函数
            if (!baseId) { // 如果 slugify 返回空（例如标题全是特殊字符）
                baseId = 'section'; // 提供一个默认的基础ID
            }
            let finalId = baseId;
            let counter = 1;
            // 确保ID在整个文档中是唯一的，并且在当前处理的标题中也是唯一的
            while (document.getElementById(finalId) || usedIds.has(finalId)) {
                finalId = `${baseId}-${counter}`;
                counter++;
            }
            heading.id = finalId;
            usedIds.add(finalId); // 记录已使用的ID
        }
        const headingId = heading.id;

        // 根据标题级别调整目录层级
        let currentLevel = levelStack[levelStack.length - 1];

        if (headingLevel > currentLevel) {
            // 当前标题级别更高，创建新的嵌套 ul
            const newUl = document.createElement('ul');
            // 将新 ul 添加到上一个 li 中 (如果上一个li存在)
            const lastLi = currentUl.lastElementChild;
            if (lastLi) {
                 lastLi.appendChild(newUl);
            } else {
                 // 如果当前ul没有li，直接添加到当前ul (这种情况通常不发生，除非层级处理有误)
                 currentUl.appendChild(newUl);
                 console.warn("TOC level logic might be off: appending new UL without a parent LI");
            }

            currentUl = newUl; // 更新当前 ul
            ulStack.push(newUl);
            levelStack.push(headingLevel); // 更新当前层级
        } else if (headingLevel < currentLevel) {
             // 当前标题级别更低，回到父级 ul
             while (levelStack.length > 1 && headingLevel <= levelStack[levelStack.length - 1]) {
                 ulStack.pop();
                 levelStack.pop();
             }
             currentUl = ulStack[ulStack.length - 1]; // 更新当前 ul
        }
        // 如果 headingLevel == currentLevel，直接在 currentUl 中添加 li

        // 创建目录项 Li 和 A 链接
        const li = document.createElement('li');
        const a = document.createElement('a');
        a.href = `#${headingId}`; // 锚点链接
        a.textContent = headingText; // 链接文本
        a.classList.add('toc-link'); // 添加类方便高亮

        li.appendChild(a);
        currentUl.appendChild(li); // 添加到当前 ul 中
    });

    // 将生成的目录添加到页面中
    tocElement.appendChild(rootUl);
}


/**
 * 设置目录滚动高亮功能
 * @param {HTMLElement} contentElement - 包含文章内容的元素
 * @param {HTMLElement} tocElement - 插入目录的元素
 */
function setupTableOfContentsHighlighting(contentElement, tocElement) {
    const tocLinks = tocElement.querySelectorAll('.toc-link');
    const headings = Array.from(contentElement.querySelectorAll('h2, h3, h4, h5, h6')); // 转换为数组，方便处理

    if (headings.length === 0 || tocLinks.length === 0) {
        return; // 没有标题或目录链接，无需设置高亮
    }

    const observerOptions = {
        rootMargin: '0px 0px -60% 0px', // 视口顶部的 40%区域为触发区域
        threshold: 0 // 标题的任意部分进入该区域即触发
    };

    const currentlyIntersectingHeadings = new Set();

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                currentlyIntersectingHeadings.add(entry.target);
            } else {
                currentlyIntersectingHeadings.delete(entry.target);
            }
        });

        let closestHeadingToTop = null;
        let minDistance = Infinity;

        currentlyIntersectingHeadings.forEach(heading => {
            const rect = heading.getBoundingClientRect();
            // 判断标题顶部是否在视口内，并且在预设的顶部激活区域 (0% 到 40% viewport height)
            if (rect.top >= 0 && rect.top < window.innerHeight * 0.4) {
                if (rect.top < minDistance) {
                    minDistance = rect.top;
                    closestHeadingToTop = heading;
                }
            }
        });

        // 移除所有链接的高亮
        tocLinks.forEach(link => link.classList.remove('active'));

        // 高亮距离顶部最近的那个标题对应的链接
        if (closestHeadingToTop) {
            const id = closestHeadingToTop.id;
            const currentActiveLink = tocElement.querySelector(`a[href="#${id}"]`);
            if (currentActiveLink) {
                currentActiveLink.classList.add('active');

                // 如果目录本身可滚动，则将高亮的目录项滚动到可见区域
                if (tocElement.scrollHeight > tocElement.clientHeight) {
                    const tocRect = tocElement.getBoundingClientRect();
                    const linkRect = currentActiveLink.getBoundingClientRect();
                    // 如果链接顶部在目录视区之上 或 链接底部在目录视区之下
                    if (linkRect.top < tocRect.top || linkRect.bottom > tocRect.bottom) {
                         currentActiveLink.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                    }
                }
            }
        }
    }, observerOptions);

    // 开始监听所有标题
    headings.forEach(heading => {
        observer.observe(heading);
    });

    // 处理页面加载时首次定位高亮 (保持不变)
    const hash = window.location.hash;
    if (hash) {
        try {
            // 确保DOM元素确实存在
            const targetHeading = document.querySelector(hash);
            if (targetHeading && headings.includes(targetHeading)) { // 确保目标是我们要观察的标题之一
                 const correspondingLink = tocElement.querySelector(`a[href="${hash}"]`);
                 if (correspondingLink) {
                     tocLinks.forEach(link => link.classList.remove('active'));
                     correspondingLink.classList.add('active');
                      if (tocElement.scrollHeight > tocElement.clientHeight) {
                           correspondingLink.scrollIntoView({ behavior: 'smooth', block: 'center' });
                      }
                 }
            }
        } catch (e) {
             console.error("Error handling initial hash:", e);
        }
    }

     // 平滑滚动到锚点 (保持不变)
     tocElement.addEventListener('click', (event) => {
         if (event.target.tagName === 'A' && event.target.classList.contains('toc-link')) {
              const href = event.target.getAttribute('href');
              if (href && href.startsWith('#')) {
                  const targetId = href.substring(1);
                  const targetElement = document.getElementById(targetId);
                  if (targetElement) {
                      event.preventDefault();
                      targetElement.scrollIntoView({
                          behavior: 'smooth',
                          block: 'start'
                      });
                       history.pushState(null, null, href);
                  }
              }
         }
     });
}


// 辅助函数：简单的文本转换为 slug ID
function slugify(text) {
  return text.toString().toLowerCase()
    .replace(/\s+/g, '-')           // 将空格替换为 -
    .replace(/[^\w-]+/g, '')       // 移除所有非单词字符
    .replace(/--+/g, '-')         // 将多个 - 替换为单个 -
    .replace(/^-+/, '')            // 移除开头的 -
    .replace(/-+$/, '');           // 移除结尾的 -
}
