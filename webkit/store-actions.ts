export async function handleAgeCheck(): Promise<void> {
  const day   = document.querySelector<HTMLSelectElement>("select[name='ageDay'],#ageDay");
  const month = document.querySelector<HTMLSelectElement>("select[name='ageMonth'],#ageMonth");
  const year  = document.querySelector<HTMLSelectElement>("select[name='ageYear'],#ageYear");

  const fire = (el: HTMLSelectElement | null, val: string) => {
    if (!el) return;
    el.value = val;
    el.dispatchEvent(new Event('change'));
  };

  try {
    fire(day,   '1');
    fire(month, 'January');
    fire(year,  '2007');
    await new Promise((res) => setTimeout(res, 300));

    const link = document.querySelector<HTMLAnchorElement>(
      'a[href*="HideAgeGate"], a[href*="ViewProductPage"], a.view_product_page_btn, #app_agegate a.btn_green_steamui',
    );
    if (link) link.click();
  } catch {}
}

const BTN_SELECTORS = [
  'a[href*="AddFreeLicense"]',
  '.game_purchase_action a.btn_green_steamui',
  '.game_purchase_action a.btn_blue_steamui',
  '.game_purchase_action .btn_green_steamui',
  '.game_area_purchase_game a.btn_green_steamui',
];

const ATTEMPTS = 8;
const POLL_MS  = 1000;

function isClickable(node: HTMLElement): boolean {
  if (node.classList.contains('btn_disabled'))     return false;
  if (node.classList.contains('btn_grey_steamui')) return false;
  const style = getComputedStyle(node);
  if (style.display === 'none' || style.visibility === 'hidden') return false;
  return true;
}

export async function tryClickButton(): Promise<boolean> {
  for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
    for (const sel of BTN_SELECTORS) {
      const nodes = document.querySelectorAll<HTMLElement>(sel);
      for (const node of Array.from(nodes)) {
        if (!isClickable(node)) continue;
        node.click();
        return true;
      }
    }
    await new Promise((res) => setTimeout(res, POLL_MS));
  }
  return false;
}
