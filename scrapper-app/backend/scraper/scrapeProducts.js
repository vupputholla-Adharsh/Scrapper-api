const puppeteer = require("puppeteer");
const Product = require("../models/Product");

async function scrapeProducts(url) {
  let browser;
  
  try {
    browser = await puppeteer.launch({
      headless: "new",
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--single-process',
        '--disable-gpu'
      ],
    });

    const page = await browser.newPage();
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );

    console.log(`Scraping: ${url}`);
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
    await page.waitForTimeout(3000);

    for (let i = 0; i < 5; i++) {
      await page.evaluate(() => {
        window.scrollBy(0, window.innerHeight);
      });
      await page.waitForTimeout(1000);
    }
    
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(1000);

    const result = await page.evaluate((sourceUrl) => {
      const baseUrl = new URL(sourceUrl).origin;
      const productList = [];

      const selectors = [
        '.product-base',
        'div[class*="product-base"]',
        'li[class*="product"]',
        'div[class*="ProductContainer"]',
        '[data-automation-id="ProductCard"]',
      ];

      let productElements = [];
      
      for (const selector of selectors) {
        const elements = document.querySelectorAll(selector);
        if (elements.length > 0) {
          productElements = Array.from(elements);
          break;
        }
      }
      
      if (productElements.length === 0) {
        const allLinks = document.querySelectorAll('a[href*="/p/"]');
        const linkMap = new Map();
        allLinks.forEach(link => {
          const container = link.closest('div, li, article, section');
          if (container && !linkMap.has(container)) {
            linkMap.set(container, link);
          }
        });
        productElements = Array.from(linkMap.keys());
      }

      productElements.forEach((el) => {
        try {
          let linkEl = null;
          let href = '';

          linkEl = el.querySelector('a[href*="/p/"]');
          if (linkEl) {
            href = linkEl.getAttribute('href') || linkEl.href || '';
          }

          if (!href) {
            const allLinks = el.querySelectorAll('a');
            for (const link of allLinks) {
              const linkHref = link.getAttribute('href') || link.href || '';
              if (linkHref && (linkHref.includes('/p/') || linkHref.match(/\/[^\/]+\/[^\/]+\//))) {
                linkEl = link;
                href = linkHref;
                break;
              }
            }
          }

          if (!href && el.tagName === 'A') {
            href = el.getAttribute('href') || el.href || '';
            if (href) linkEl = el;
          }

          if (!href) {
            const parentLink = el.closest('a');
            if (parentLink) {
              href = parentLink.getAttribute('href') || parentLink.href || '';
              if (href) linkEl = parentLink;
            }
          }
          
          if (!href) return;
          
          if (!href.startsWith('http')) {
            if (!href.startsWith('/')) {
              href = `/${href}`;
            }
            href = `${baseUrl}${href}`;
          }
          
          const pathParts = new URL(href).pathname.split('/').filter(p => p);
          const isProductUrl = pathParts.length >= 3 && !href.includes('/search') && !href.includes('/account');
          if (!isProductUrl) return;

          const titleEl = el.querySelector('h3, h4, [class*="product-brand"], [class*="product-title"], [class*="brand-name"], [class*="product-name"]');
          const priceEl = el.querySelector('[class*="price"], [class*="discountedPrice"], [class*="product-price"], [class*="product-discountedPrice"]');
          const imgEl = el.querySelector('img');
          const ratingEl = el.querySelector('[class*="rating"], [class*="product-ratingsContainer"], [class*="product-ratingsCount"]');

          const product = {
            name: titleEl?.textContent?.trim() || '',
            price: priceEl?.textContent?.trim() || '',
            rating: ratingEl?.textContent?.trim() || '',
            image: imgEl?.getAttribute('src') || imgEl?.getAttribute('data-src') || imgEl?.getAttribute('data-lazy-src') || imgEl?.getAttribute('srcset')?.split(' ')[0] || '',
            productUrl: href,
            sourceUrl: sourceUrl,
          };

          if (product.productUrl) {
            productList.push(product);
          }
        } catch (err) {
        }
      });

      return productList;
    }, url);

    console.log(`Extracted ${result.length} products from page`);

    await browser.close();

    let saved = 0;
    let skipped = 0;

    for (const product of result) {
      try {
        await Product.create(product);
        saved++;
      } catch (err) {
        if (err.code === 11000) {
          skipped++;
        } else {
          console.error('Error saving product:', err.message);
          throw err;
        }
      }
    }

    console.log(`Saved: ${saved}, Skipped: ${skipped}, Total: ${result.length}`);
    return { saved, skipped, total: result.length };

  } catch (error) {
    if (browser) await browser.close();
    throw error;
  }
}

module.exports = scrapeProducts;
