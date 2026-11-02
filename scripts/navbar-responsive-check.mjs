import { chromium } from '@playwright/test';

const BASE = process.env.ACCEPTANCE_URL || process.env.NAV_CHECK_URL || 'http://localhost:3000';
const PATH = process.env.NAV_CHECK_PATH || '/impressum';
const WIDTHS = [768, 834, 1024, 1112, 1180, 1280, 1366, 1440];
const LOCALES = ['de', 'en'];

const browser = await chromium.launch();
let failures = 0;

for (const locale of LOCALES) {
  for (const width of WIDTHS) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    const res = await page.goto(`${BASE}/${locale}${PATH}`, { waitUntil: 'networkidle' });
    if (!res?.ok()) {
      console.log(`${locale} ${width}px  -> HTTP ${res?.status()} (Seite nicht ladbar)`);
      failures++;
      await page.close();
      continue;
    }
    await page.waitForSelector('nav.fixed', { timeout: 10000 });

    const m = await page.evaluate(() => {
      const nav = document.querySelector('nav.fixed');
      const container = nav?.querySelector('div[class*="max-w-[1600px]"]');
      const row = container?.firstElementChild;
      const desktopMenu = [...(row?.children || [])].find(
        (el) => el.className.includes('lg:flex') || el.className.includes('md:flex')
      );
      const mobileBtns = [...(row?.children || [])].find((el) =>
        el.className.includes('lg:hidden') || el.className.includes('md:hidden')
      );
      const visible = (el) => {
        if (!el) return false;
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
      };
      const box = (el) => (el ? el.getBoundingClientRect() : null);
      const cBox = box(container);
      const mBox = box(desktopMenu);
      const last = desktopMenu?.lastElementChild ? box(desktopMenu.lastElementChild) : null;
      return {
        rowScroll: row?.scrollWidth ?? 0,
        rowClient: row?.clientWidth ?? 0,
        desktopVisible: visible(desktopMenu),
        mobileVisible: visible(mobileBtns),
        menuRight: last ? Math.round(last.right) : null,
        containerRight: cBox ? Math.round(cBox.right) : null,
        containerLeft: cBox ? Math.round(cBox.left) : null,
        menuWidth: mBox ? Math.round(mBox.width) : null,
        logoWidth: Math.round(box(document.querySelector('nav.fixed img'))?.width ?? 0),
      };
    });

    const overflow = m.rowScroll - m.rowClient;
    const spillsRight = m.menuRight != null && m.containerRight != null && m.menuRight > m.containerRight + 1;
    const bothMenus = m.desktopVisible && m.mobileVisible;
    const ok = overflow <= 0 && !spillsRight && !bothMenus;
    if (!ok) failures++;

    console.log(
      `${ok ? 'OK  ' : 'BUG '} ${locale} ${String(width).padStart(4)}px | ` +
      `Desktop:${m.desktopVisible ? 'ja' : 'nein'} Mobile:${m.mobileVisible ? 'ja' : 'nein'} | ` +
      `Menü ${m.menuWidth ?? '-'}px, Logo ${m.logoWidth}px | ` +
      `Rechts ${m.menuRight ?? '-'} / Container ${m.containerRight ?? '-'} | ` +
      `Overflow ${overflow}px`
    );
    await page.close();
  }
}

await browser.close();
console.log(failures === 0 ? '\nAlle Viewports sauber.' : `\n${failures} Viewport(s) mit Problem.`);
process.exit(failures === 0 ? 0 : 1);
