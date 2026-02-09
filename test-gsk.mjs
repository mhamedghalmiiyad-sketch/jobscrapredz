import puppeteer from "puppeteer";

async function testGSK() {
  console.log("🚀 Launching browser...");
  // headless: false means YOU SEE THE BROWSER
  const browser = await puppeteer.launch({ headless: false, defaultViewport: null });
  const page = await browser.newPage();

  console.log("🌍 Going to GSK jobs page...");
  await page.goto("https://jobs.gsk.com/en-gb/jobs?keywords=Algeria&page=1", {
    waitUntil: "networkidle2",
    timeout: 60000 
  });

  // 1. Try to click the cookie button
  try {
    console.log("🍪 Looking for cookie banner...");
    const acceptBtn = await page.waitForSelector('#pixel-consent-accept-button', { timeout: 5000 });
    if (acceptBtn) {
        console.log("✅ Cookie button found! Clicking it...");
        await acceptBtn.click();
        await new Promise(r => setTimeout(r, 2000)); // wait for fade out
    }
  } catch (e) {
    console.log("⚠️ No cookie banner appeared (or ID changed).");
  }

  // 2. Extract jobs
  console.log("🔍 Extracting jobs...");
  try {
      await page.waitForSelector('.job-results-list', { timeout: 10000 });
  } catch {
      console.log("⚠️ Could not find .job-results-list. Site might be empty or loading slow.");
  }

  const jobs = await page.evaluate(() => {
    // Look for links containing "/jobs/"
    const links = Array.from(document.querySelectorAll('a[href*="/jobs/"]'));
    
    return links.map(a => {
      const container = a.closest('li') || a.closest('div');
      return {
        title: a.innerText.trim(),
        url: a.href,
        location: container ? container.innerText.match(/Location\s*\n\s*(.*)/i)?.[1] : "Unknown"
      };
    });
  });

  console.log("\n📊 RESULTS:");
  console.log(JSON.stringify(jobs, null, 2));
  console.log(`\nFound ${jobs.length} jobs.`);

  // Keep browser open for 5 seconds so you can see it
  await new Promise(r => setTimeout(r, 5000));
  await browser.close();
}

testGSK();