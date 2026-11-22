import { useEffect, useState } from 'react';
import { Smartphone } from 'lucide-react';
import { Btn, Sheet } from './Panels';

type Os = 'ios' | 'android';
type BIP = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };
const standalone = () => matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true;

const STEPS: Record<Os, string[]> = {
  ios: [
    'Откройте сайт в Safari. В других браузерах на iPhone пункта может не быть.',
    'Нажмите кнопку «Поделиться» внизу экрана — квадрат со стрелкой вверх. Если панели не видно, коснитесь адресной строки или прокрутите чуть вверх.',
    'Пролистайте меню вниз и выберите «На экран „Домой“».',
    'Проверьте название и нажмите «Добавить» в правом верхнем углу.',
    'На рабочем столе появится иконка с эмблемой клуба. Открывайте сайт через неё — он работает как приложение и даже без интернета.',
  ],
  android: [
    'Откройте сайт в Chrome.',
    'Нажмите три точки ⋮ в правом верхнем углу.',
    'Выберите «Установить приложение» или «Добавить на главный экран».',
    'Подтвердите — «Установить» или «Добавить».',
    'Иконка с эмблемой клуба появится на рабочем столе. В Яндекс Браузере и Samsung Internet пункт тоже в меню: «Добавить ярлык» / «Добавить на главный экран».',
  ],
};

export function InstallButtons() {
  const [os, setOs] = useState<Os | null>(null);
  const [bip, setBip] = useState<BIP | null>(null);
  useEffect(() => { const f = (e: Event) => { e.preventDefault(); setBip(e as BIP); }; addEventListener('beforeinstallprompt', f); return () => removeEventListener('beforeinstallprompt', f); }, []);
  if (standalone()) return null;
  return (
    <div className="mt-5">
      <div className="text-sm text-cream/70 px-1 mb-2">Установить на телефон как приложение</div>
      <div className="grid grid-cols-2 gap-2">
        {(['ios', 'android'] as const).map((o) => (
          <button key={o} onClick={() => setOs(o)} className="h-10 rounded-xl bg-moss/70 border border-moss-light text-sm text-cream inline-flex items-center justify-center gap-2"><Smartphone size={16} className="text-sand-light" />{o === 'ios' ? 'Для iPhone (iOS)' : 'Для Android'}</button>
        ))}
      </div>
      <Sheet open={!!os} onClose={() => setOs(null)} title={os === 'ios' ? 'Установка на iPhone' : 'Установка на Android'}
        footer={os === 'android' && bip ? <div className="pb-3"><Btn tone="gold" className="w-full" onClick={async () => { await bip.prompt(); setBip(null); setOs(null); }}>Установить сейчас</Btn></div> : undefined}>
        {os && (
          <div className="grid gap-3">
            <ul className="help-steps">{STEPS[os].map((s, i) => <li key={i}>{s}</li>)}</ul>
            {os === 'ios' && <img src={`${import.meta.env.BASE_URL}help/ios-1-share.webp`} alt="" className="rounded-xl border border-moss-light" />}
            {os === 'ios' && <img src={`${import.meta.env.BASE_URL}help/ios-2-home.webp`} alt="" className="rounded-xl border border-moss-light" />}
            <div className="help-tip"><span>В установленном сайте нет кнопок браузера. Для перехода используйте круглую кнопку с компасом в правом нижнем углу: «Наверх», «На главную», «Обновить».</span></div>
            <p className="text-xs text-cream/50">Листы в браузере и в иконке хранятся отдельно. Если уже завели героя в браузере, сохраните его файлом (.json) и откройте в иконке.</p>
          </div>
        )}
      </Sheet>
    </div>
  );
}
