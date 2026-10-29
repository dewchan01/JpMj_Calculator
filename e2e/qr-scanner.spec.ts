import { test, expect } from '@playwright/test';
import QRCode from 'qrcode';

test.use({ serviceWorkers: 'block', viewport: { width: 390, height: 844 } });

test.beforeEach(async ({ page }) => {
  await page.route('**/config.json', (route) =>
    route.fulfill({
      json: { backend: { apiUrl: 'https://api.example.test' } },
    }),
  );
  await page.goto('/');
});

async function openJoin(page: import('@playwright/test').Page) {
  await page.getByRole('button', { name: /Start match/ }).click();
  await page.getByRole('button', { name: 'Start shared game', exact: true }).click();
  await page.getByRole('button', { name: 'Join game', exact: true }).click();
}

test('camera keeps scanning blank frames, joins after QR appears, and stops the camera', async ({
  page,
}) => {
  const qr = await QRCode.toDataURL('https://example.test/#/online?room=ABCDEF1234&pin=123456', {
    width: 300,
    margin: 4,
  });
  await page.evaluate((qr) => {
    Object.defineProperty(window, 'BarcodeDetector', { value: undefined, configurable: true });
    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 480;
    const context = canvas.getContext('2d')!;
    const image = new Image();
    image.src = qr;
    let ticks = 0;
    const timer = setInterval(() => {
      context.fillStyle = '#eee';
      context.fillRect(0, 0, 640, 480);
      if (++ticks > 5 && image.complete) context.drawImage(image, 170, 90, 300, 300);
    }, 200);
    const stream = canvas.captureStream(5);
    const state = { stopped: false };
    Object.assign(window, { cameraTest: state });
    for (const track of stream.getTracks()) {
      const stop = track.stop.bind(track);
      track.stop = () => {
        state.stopped = true;
        clearInterval(timer);
        stop();
      };
    }
    Object.defineProperty(navigator.mediaDevices, 'getUserMedia', {
      configurable: true,
      value: async () => stream,
    });
  }, qr);
  await page.route('**/api/rooms/ABCDEF1234/join', (route) => {
    expect(route.request().postDataJSON()).toEqual({ pin: '123456' });
    return route.fulfill({ status: 401 });
  });
  await openJoin(page);
  await page.getByRole('button', { name: 'Scan room QR code', exact: true }).click();
  const scanner = page.getByRole('dialog', { name: 'Scan room QR code', exact: true });
  await expect(scanner.locator('video')).toBeVisible();
  await expect(scanner.getByRole('alert')).toHaveCount(0);
  await expect(page.getByRole('alert')).toHaveText('Room credentials are incorrect or expired.');
  await expect(scanner).not.toBeVisible();
  expect(
    await page.evaluate(
      () =>
        (
          window as typeof window & {
            cameraTest: { stopped: boolean };
          }
        ).cameraTest.stopped,
    ),
  ).toBe(true);
});

test('camera denial allows choosing a QR image and closing keeps the join prompt', async ({
  page,
}) => {
  await page.evaluate(() =>
    Object.defineProperty(navigator.mediaDevices, 'getUserMedia', {
      configurable: true,
      value: async () => {
        throw new DOMException('Denied', 'NotAllowedError');
      },
    }),
  );
  await openJoin(page);
  await page.getByRole('button', { name: 'Scan room QR code', exact: true }).click();
  const scanner = page.getByRole('dialog', { name: 'Scan room QR code', exact: true });
  await expect(scanner.getByRole('alert')).toHaveText(
    'Camera unavailable. Allow camera access or choose a QR image.',
  );
  await expect(scanner.getByRole('button', { name: 'Choose QR image', exact: true })).toBeVisible();
  await scanner.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Join game', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Scan room QR code', exact: true }).click();
  await scanner.locator('input[type=file]').setInputFiles('apps/web/public/icons/icon-192.png');
  const toast = page.locator('.toast');
  await expect(toast).toContainText('No QR code found.');
  await expect(scanner.locator('app-error-notice')).toHaveCount(0);
  await expect(scanner).toBeVisible();
  await toast.getByRole('button', { name: 'Dismiss notification', exact: true }).click();
  await scanner.locator('input[type=file]').setInputFiles({
    name: 'qr.png',
    mimeType: 'image/png',
    buffer: await QRCode.toBuffer('ABCDEF1234'),
  });
  await expect(scanner).not.toBeVisible();
  await expect(page.getByLabel('Room code', { exact: true })).toHaveValue('ABCDEF1234');
});
