import fs from 'fs';
import path from 'path';

let stepCounter = 0;

export async function captureGuideStep(page, {
  instruction,
  action = 'Klik',
  expected = '',
  target = null,
} = {}) {
  if (process.env.SPSE_GUIDE_CAPTURE !== 'true') return;
  const flow = process.env.SPSE_GUIDE_FLOW || 'flow';
  const root = path.resolve(
    process.cwd(),
    process.env.SPSE_GUIDE_DIR || 'docs/visual-guide'
  );
  const outputDir = path.join(root, flow);
  fs.mkdirSync(outputDir, { recursive: true });
  stepCounter += 1;
  const step = String(stepCounter).padStart(2, '0');
  const safeName = instruction
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60) || 'step';
  const imageName = `${step}-${safeName}.png`;
  const imagePath = path.join(outputDir, imageName);

  let box = null;
  if (target) {
    await target.scrollIntoViewIfNeeded().catch(() => null);
    box = await target.boundingBox().catch(() => null);
  }
  await page.evaluate(({
    boxData, label, number
  }) => {
    document.querySelector('#codex-guide-overlay')?.remove();
    const overlayRoot = document.createElement('div');
    overlayRoot.id = 'codex-guide-overlay';
    overlayRoot.style.position = 'fixed';
    overlayRoot.style.inset = '0';
    overlayRoot.style.pointerEvents = 'none';
    overlayRoot.style.zIndex = '2147483647';
    if (boxData) {
      const marker = document.createElement('div');
      marker.style.position = 'absolute';
      marker.style.left = `${Math.max(4, boxData.x - 8)}px`;
      marker.style.top = `${Math.max(4, boxData.y - 8)}px`;
      marker.style.width = `${boxData.width + 16}px`;
      marker.style.height = `${boxData.height + 16}px`;
      marker.style.border = '5px solid #ff7a00';
      marker.style.borderRadius = '18px';
      marker.style.boxShadow = '0 0 0 4px rgba(255,255,255,.9)';
      overlayRoot.appendChild(marker);

      const badge = document.createElement('div');
      badge.textContent = number;
      badge.style.position = 'absolute';
      badge.style.left = `${Math.max(4, boxData.x - 22)}px`;
      badge.style.top = `${Math.max(4, boxData.y - 22)}px`;
      badge.style.width = '38px';
      badge.style.height = '38px';
      badge.style.borderRadius = '50%';
      badge.style.background = '#ff7a00';
      badge.style.color = '#fff';
      badge.style.font = '700 20px Arial';
      badge.style.display = 'flex';
      badge.style.alignItems = 'center';
      badge.style.justifyContent = 'center';
      badge.style.boxShadow = '0 2px 10px rgba(0,0,0,.35)';
      overlayRoot.appendChild(badge);
    }
    const caption = document.createElement('div');
    caption.textContent = label;
    caption.style.position = 'absolute';
    caption.style.left = '24px';
    caption.style.bottom = '24px';
    caption.style.maxWidth = '70vw';
    caption.style.padding = '14px 20px';
    caption.style.borderRadius = '10px';
    caption.style.background = 'rgba(26,31,44,.95)';
    caption.style.color = '#fff';
    caption.style.font = '700 18px Arial';
    caption.style.boxShadow = '0 4px 18px rgba(0,0,0,.35)';
    overlayRoot.appendChild(caption);
    document.body.appendChild(overlayRoot);
  }, {
    boxData: box,
    label: `${action.toUpperCase()}: ${instruction}`,
    number: String(stepCounter),
  });
  await page.screenshot({
    path: imagePath,
    fullPage: false
  });
  await page.evaluate(() => {
    document.querySelector('#codex-guide-overlay')?.remove();
  });

  const record = {
    step: stepCounter,
    flow,
    action,
    instruction,
    expected,
    image: path.relative(root, imagePath),
  };
  fs.appendFileSync(
    path.join(root, `${flow}.jsonl`),
    `${JSON.stringify(record)}\n`
  );
}
