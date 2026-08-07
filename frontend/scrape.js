const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

async function runScraper() {
  const targetUrl = process.argv[2] || 'http://localhost:3000';
  console.log(`==================================================`);
  console.log(`[Scraper] Initializing Playwright Chromium`);
  console.log(`[Scraper] Target URL: ${targetUrl}`);
  console.log(`==================================================\n`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    const response = await page.goto(targetUrl, { waitUntil: 'networkidle', timeout: 30000 });
    const statusCode = response ? response.status() : 'N/A';
    const pageTitle = await page.title();

    console.log(`[Status]: ${statusCode}`);
    console.log(`[Title ]: ${pageTitle}\n`);

    // Scrape Headings
    const headings = await page.$$eval('h1, h2, h3, h4, h5, h6', els => els.map(e => ({
      tag: e.tagName.toLowerCase(),
      text: e.innerText.trim()
    })).filter(h => h.text.length > 0));

    // Scrape Links
    const links = await page.$$eval('a[href]', els => els.map(e => ({
      text: e.innerText.trim() || '[Icon/Image Link]',
      href: e.href
    })));

    // Scrape Buttons & Actions
    const buttons = await page.$$eval('button, input[type="submit"], input[type="button"]', els => els.map(e => ({
      type: e.tagName.toLowerCase(),
      text: (e.innerText || e.value || '').trim()
    })).filter(b => b.text.length > 0));

    // Scrape Form Inputs
    const inputs = await page.$$eval('input, textarea, select', els => els.map(e => ({
      type: e.type || e.tagName.toLowerCase(),
      name: e.name || e.id || 'unnamed',
      placeholder: e.placeholder || ''
    })));

    // Extract Main Content Paragraphs
    const textSnippets = await page.$$eval('p, span, div', els => els.map(e => e.innerText.trim())
      .filter(t => t.length > 20 && !t.includes('{') && !t.includes('}'))
      .slice(0, 15)
    );

    const scrapedResult = {
      url: targetUrl,
      timestamp: new Date().toISOString(),
      statusCode,
      pageTitle,
      stats: {
        totalHeadings: headings.length,
        totalLinks: links.length,
        totalButtons: buttons.length,
        totalInputs: inputs.length
      },
      headings,
      links,
      buttons,
      inputs,
      textSnippets: [...new Set(textSnippets)]
    };

    // Save JSON output
    const outputPath = path.join(__dirname, 'scraped_output.json');
    fs.writeFileSync(outputPath, JSON.stringify(scrapedResult, null, 2));

    console.log(`=== SCRAPE SUMMARY ===`);
    console.log(`- Headings found: ${headings.length}`);
    console.log(`- Links found   : ${links.length}`);
    console.log(`- Buttons found : ${buttons.length}`);
    console.log(`- Inputs found  : ${inputs.length}\n`);

    console.log(`=== HEADINGS ===`);
    headings.forEach(h => console.log(`  <${h.tag}> ${h.text}`));

    console.log(`\n=== BUTTONS & ACTIONS ===`);
    buttons.forEach(b => console.log(`  [${b.type}] ${b.text}`));

    console.log(`\n=== KEY LINKS ===`);
    links.slice(0, 8).forEach(l => console.log(`  🔗 ${l.text} -> ${l.href}`));

    console.log(`\n[Scraper] Scraped data successfully saved to: ${outputPath}`);

  } catch (err) {
    console.error('[Scraper Error]:', err.message);
  } finally {
    await browser.close();
    console.log('\n[Scraper] Process completed.');
  }
}

runScraper();
