import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { openQuickScore } from './helpers/navigation';

test.use({ serviceWorkers: 'block', viewport: { width: 390, height: 844 } });

for (const count of [3, 4]) {
  test(`guided camera uses the full frame and assigns source, Kan and North at ${count}P`, async ({
    page,
  }) => {
    const endpoint = 'https://detector.example/guided';
    const predictions: Array<{
      class: string;
      confidence: number;
      x: number;
      y: number;
      width: number;
      height: number;
    }> = [];
    function add(label: string, x: number, y: number, width = 0.05, height = 0.12) {
      predictions.push({
        class: label,
        confidence: 0.95,
        x: x * 1280,
        y: y * 960,
        width: width * 1280,
        height: height * 960,
      });
    }
    ['1p', '2p', '3p', '7s', '8s', '9s', '1z', '1z'].forEach((label, i) =>
      add(label, 0.08 + i * 0.09, 0.18),
    );
    add('0p', 0.075, 0.55, 0.075, 0.05);
    add('5p', 0.145, 0.55, 0.035);
    add('5p', 0.195, 0.55, 0.035);
    [0.08, 0.17, 0.26, 0.35].forEach((x) => add('4s', x, 0.86, 0.06));
    if (count === 3) [0.8, 0.9].forEach((x) => add('4z', x, 0.86, 0.06));
    let uploaded = '';
    await page.route('**/config.json', (route) =>
      route.fulfill({ json: { recognition: { provider: 'api', endpoint, timeoutMs: 30000 } } }),
    );
    await page.route(endpoint, (route) => {
      uploaded = (route.request().postDataJSON() as { image: string }).image;
      return route.fulfill({ json: { image: { width: 1280, height: 960 }, predictions } });
    });
    await page.goto('/');
    await openQuickScore(page);
    if (count === 3)
      await page
        .getByRole('combobox', { name: 'Rules', exact: true })
        .selectOption({ label: '3P · Sanma' });
    await page.evaluate(() => {
      const canvas = document.createElement('canvas');
      canvas.width = 1280;
      canvas.height = 960;
      const context = canvas.getContext('2d')!;
      const draw = () => {
        context.fillStyle = 'rgb(18, 70, 50)';
        context.fillRect(0, 0, 1280, 960);
      };
      draw();
      const timer = setInterval(draw, 100);
      const stream = canvas.captureStream(10);
      const state = { stopped: false };
      Object.assign(window, { guidedCameraTest: state });
      stream.getTracks().forEach((track) => {
        const stop = track.stop.bind(track);
        track.stop = () => {
          state.stopped = true;
          clearInterval(timer);
          stop();
        };
      });
      Object.defineProperty(navigator.mediaDevices, 'getUserMedia', {
        configurable: true,
        value: async () => stream,
      });
    });
    await page.getByRole('button', { name: 'Enter tiles', exact: true }).click();
    const capture = page.locator('app-photo-capture').first();
    await capture.getByRole('button', { name: 'Guided photo', exact: true }).click();
    const camera = page.getByRole('dialog', { name: 'Guided photo', exact: true });
    await expect(camera.locator('.camera-zone')).toHaveCount(count === 3 ? 7 : 6);
    await expect(camera.locator('.camera-frame')).toHaveCSS('aspect-ratio', '1.33333 / 1');
    await expect(camera.getByRole('combobox', { name: 'Meld area 2', exact: true })).toHaveValue(
      count === 3 ? 'p2' : 'p3',
    );
    await camera
      .getByRole('combobox', { name: 'Meld area 1', exact: true })
      .selectOption({ label: 'Next player' });
    await expect(camera.locator('.camera-zone').nth(1)).toHaveText('Meld area 1');
    await expect(camera.locator('.camera-grid')).not.toContainText('Player 3');
    await expect(
      camera
        .getByRole('combobox', { name: 'Meld area 1', exact: true })
        .getByRole('option', { name: 'Opposite player', exact: true }),
    ).toHaveCount(count === 3 ? 0 : 1);
    expect(
      (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
        .violations,
    ).toEqual([]);
    await page.screenshot({ path: `artifacts/guided-camera-${count}p-390.png` });
    await camera.getByRole('button', { name: 'Take a photo', exact: true }).click();
    await expect(camera).not.toBeVisible();
    await expect(capture.locator('.layout-group')).toHaveCount(count === 3 ? 3 : 2);
    const pon = capture.locator('.layout-group').filter({ hasText: '· Pon' });
    await expect(pon.getByRole('combobox', { name: 'Called from', exact: true })).toHaveValue('p2');
    await expect(
      capture.getByRole('button', { name: 'Apply reviewed tiles', exact: true }),
    ).toBeEnabled();
    const image = Buffer.from(uploaded, 'base64');
    expect([image.readUInt32BE(16), image.readUInt32BE(20)]).toEqual([1280, 960]);
    // The white grid is UI only: a pixel on its border stays the original green video.
    const pixel = await page.evaluate(async (data) => {
      const bitmap = await createImageBitmap(
        await (await fetch(`data:image/png;base64,${data}`)).blob(),
      );
      const canvas = document.createElement('canvas');
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const context = canvas.getContext('2d')!;
      context.drawImage(bitmap, 0, 0);
      bitmap.close();
      return [...context.getImageData(26, 39, 1, 1).data].slice(0, 3);
    }, uploaded);
    expect(Math.max(...pixel)).toBeLessThan(100);
    expect(
      await page.evaluate(
        () =>
          (window as typeof window & { guidedCameraTest: { stopped: boolean } }).guidedCameraTest
            .stopped,
      ),
    ).toBe(true);
    await capture.getByRole('button', { name: 'Apply reviewed tiles', exact: true }).click();
    await page.getByRole('button', { name: 'Done', exact: true }).click();
    await expect(page.locator('.hand-tray > .hand-tiles > button.tile')).toHaveCount(8);
    await expect(page.locator('.meld-row')).toHaveCount(2);
    await expect(
      page.locator('.meld-row').filter({ hasText: 'from Player 3' }).locator('.called.red-ink'),
    ).toHaveCount(1);
    if (count === 3) await expect(page.locator('.kita-row')).toContainText('Extracted North · 2');
  });
}
