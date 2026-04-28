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

    const link = Array.from(document.querySelectorAll<HTMLAnchorElement>('a'))
      .find((a) => /view page|открыть страницу/i.test(a.textContent || ''));
    if (link) link.click();
  } catch {}
}
const BTN_SELECTORS = [
  '.game_purchase_action .btn_green_steamui',
  '.game_purchase_action a',
  '.btn_green_steamui',
  'a.btn_green_steamui',
  'a.btn_blue_steamui',
];

const BTN_KEYWORDS = [
  'add to account', 'add to library',
  'добавить на аккаунт', 'добавить в библиотеку',
  'получить', 'get',
];

const ATTEMPTS = 8;
const POLL_MS  = 1000;
export async function tryClickButton(): Promise<boolean> {
  for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
    for (const sel of BTN_SELECTORS) {
      const nodes = document.querySelectorAll<HTMLElement>(sel);
      for (const node of Array.from(nodes)) {
        const txt = (node.textContent || '').toLowerCase().trim();
        const matched = BTN_KEYWORDS.some((k) => txt.indexOf(k) !== -1);
        if (matched) {
          node.click();
          return true;
        }
      }
    }
    await new Promise((res) => setTimeout(res, POLL_MS));
  }
  return false;
}
