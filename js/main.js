'use strict';

document.addEventListener('DOMContentLoaded', () => {
    initDrawer();
    initReveal();
    initFaq();
    initDummyLinks();
    initForm();
});

// =====================================================
// ドロワーメニュー（1099px以下）
// =====================================================
function initDrawer() {
    const drawer = document.getElementById('drawer');
    const openButton = document.querySelector('.js-menu-open');
    const closeButton = document.querySelector('.js-menu-close');
    if (!drawer || !openButton || !closeButton) return;

    const open = () => {
        drawer.hidden = false;
        openButton.setAttribute('aria-expanded', 'true');
        document.body.classList.add('is-locked');
        closeButton.focus();
    };

    const close = ({ restoreFocus = true } = {}) => {
        drawer.hidden = true;
        openButton.setAttribute('aria-expanded', 'false');
        document.body.classList.remove('is-locked');
        if (restoreFocus) openButton.focus();
    };

    openButton.addEventListener('click', open);
    closeButton.addEventListener('click', () => close());

    // メニュー内のリンクを押したら閉じて、そのままアンカー先へ移動する
    drawer.querySelectorAll('a[href^="#"]').forEach((link) => {
        link.addEventListener('click', () => close({ restoreFocus: false }));
    });

    drawer.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            close();
            return;
        }

        // Tabキーのフォーカスをドロワー内に閉じ込める
        if (e.key !== 'Tab') return;
        const focusables = drawer.querySelectorAll('a[href], button');
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
            e.preventDefault();
            last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault();
            first.focus();
        }
    });

    // PC幅に広げたら閉じる
    window.matchMedia('(min-width: 1100px)').addEventListener('change', (e) => {
        if (e.matches && !drawer.hidden) close({ restoreFocus: false });
    });
}

// =====================================================
// スクロールで出現（フェードアップ・1回のみ）
// =====================================================
function initReveal() {
    const targets = document.querySelectorAll('.reveal');
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (reduceMotion || !('IntersectionObserver' in window)) {
        targets.forEach((el) => el.classList.add('is-visible'));
        return;
    }

    const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
            if (!entry.isIntersecting) return;
            entry.target.classList.add('is-visible');
            observer.unobserve(entry.target);
        });
    }, { threshold: 0.1 });

    targets.forEach((el) => observer.observe(el));
}

// =====================================================
// FAQアコーディオン（複数同時に開ける）
// =====================================================
function initFaq() {
    document.querySelectorAll('.js-faq').forEach((button) => {
        button.addEventListener('click', () => {
            const item = button.closest('.faq__item');
            const isOpen = item.classList.toggle('is-open');
            button.setAttribute('aria-expanded', String(isOpen));
        });
    });
}

// =====================================================
// ダミーリンク（架空店舗のためLINEは遷移させない）
// =====================================================
function initDummyLinks() {
    document.querySelectorAll('.js-dummy-link').forEach((link) => {
        link.setAttribute('aria-disabled', 'true');
        link.addEventListener('click', (e) => e.preventDefault());
    });
}

// =====================================================
// 予約フォーム
// =====================================================
const WEEKDAYS = '日月火水木金土';
const WEDNESDAY = 3;

// 「2026-10-08」をローカル時刻の Date にする（new Date('2026-10-08') はUTC扱いになるため）
function parseDate(value) {
    const [y, m, d] = value.split('-').map(Number);
    return new Date(y, m - 1, d);
}

function formatDate(date) {
    const pad = (n) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

// 入力値からエラーを返す（エラーがない項目はキーを持たない）
function validate(values) {
    const errors = {};

    if (!values.name.trim()) errors.name = 'お名前を入力してください';

    const tel = values.tel.replace(/[-ー－\s]/g, '');
    if (!tel) errors.tel = '電話番号を入力してください';
    else if (!/^0\d{9,10}$/.test(tel)) errors.tel = '電話番号の形式をご確認ください（例：090-1234-5678）';

    if (!values.email.trim()) errors.email = 'メールアドレスを入力してください';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) errors.email = 'メールアドレスの形式をご確認ください';

    if (!values.d1) errors.d1 = '第1希望日を選択してください';
    else if (parseDate(values.d1).getDay() === WEDNESDAY) errors.d1 = '水曜日は定休日です。別の日をお選びください';

    if (!values.t1) errors.t1 = '第1希望の時間を選択してください';

    if (values.d2 && parseDate(values.d2).getDay() === WEDNESDAY) errors.d2 = '水曜日は定休日です。別の日をお選びください';

    return errors;
}

function initForm() {
    const form = document.querySelector('.js-form');
    const complete = document.querySelector('.js-complete');
    if (!form || !complete) return;

    const FIELD_NAMES = ['name', 'tel', 'email', 'd1', 't1', 'd2', 't2', 'symptom'];
    // 「✓ 入力済み」を表示する項目
    const OK_FIELDS = ['name', 'tel', 'email'];

    const summary = form.querySelector('.form__summary');
    const submitButton = form.querySelector('.form__button');
    const submitLabel = submitButton.textContent;
    const inputs = Object.fromEntries(FIELD_NAMES.map((name) => [name, form.elements[name]]));

    const state = { touched: new Set(), tried: false, focused: null };

    // 過去の日付は選べないようにする
    const today = formatDate(new Date());
    inputs.d1.min = today;
    inputs.d2.min = today;

    const getValues = () => Object.fromEntries(FIELD_NAMES.map((name) => [name, inputs[name].value]));

    // 各入力欄の見た目（未入力／入力済み／エラー）とメッセージを更新する
    const render = () => {
        const errors = validate(getValues());

        FIELD_NAMES.forEach((name) => {
            const input = inputs[name];
            const message = document.getElementById(`${name}-message`);
            const shown = state.touched.has(name) || state.tried;
            const error = shown ? errors[name] : null;

            input.classList.toggle('is-filled', input.value !== '');
            input.classList.toggle('is-error', Boolean(error));
            if (error) input.setAttribute('aria-invalid', 'true');
            else input.removeAttribute('aria-invalid');

            if (!message) return;
            const isOk = OK_FIELDS.includes(name) && !error && input.value !== ''
                && state.touched.has(name) && state.focused !== name;

            message.classList.toggle('is-error', Boolean(error));
            message.classList.toggle('is-ok', isOk);
            if (error) message.textContent = `! ${error}`;
            else if (isOk) message.textContent = '✓ 入力済み';
            else message.textContent = '';
        });

        const count = Object.keys(errors).length;
        if (state.tried && count > 0) {
            summary.textContent = `入力内容をご確認ください（${count}件の項目に誤りがあります）`;
            summary.hidden = false;
        } else {
            summary.hidden = true;
        }

        return errors;
    };

    FIELD_NAMES.forEach((name) => {
        const input = inputs[name];

        input.addEventListener('focus', () => {
            state.focused = name;
            render();
        });

        // フォーカスが外れたときにバリデーション
        input.addEventListener('blur', () => {
            state.focused = null;
            state.touched.add(name);
            render();
        });

        // 一度触った項目は入力中もリアルタイムに再チェック
        input.addEventListener('input', render);

        // 日付・時間は選んだ時点でチェック（水曜を選ぶと即エラー）
        if (input.type === 'date' || input.tagName === 'SELECT') {
            input.addEventListener('change', () => {
                state.touched.add(name);
                render();
            });
        }
    });

    const showComplete = (values) => {
        const date = parseDate(values.d1);
        complete.querySelector('.js-complete-name').textContent = values.name;
        complete.querySelector('.js-complete-date').textContent =
            `${date.getMonth() + 1}月${date.getDate()}日（${WEEKDAYS[date.getDay()]}）${values.t1}`;
        form.hidden = true;
        complete.hidden = false;
        complete.focus();
    };

    form.addEventListener('submit', (e) => {
        e.preventDefault();
        state.tried = true;
        const errors = render();

        if (Object.keys(errors).length > 0) {
            // 最初のエラー項目へフォーカス（固定ヘッダーに隠れないよう画面中央へスクロール）
            const firstError = inputs[FIELD_NAMES.find((name) => errors[name])];
            firstError.focus({ preventScroll: true });
            firstError.scrollIntoView({ block: 'center' });
            return;
        }

        // 送信中 → 約0.9秒後に完了パネルへ切り替え（デモのため実際には送信しない）
        submitButton.disabled = true;
        submitButton.textContent = '送信中…';
        setTimeout(() => {
            submitButton.disabled = false;
            submitButton.textContent = submitLabel;
            showComplete(getValues());
        }, 900);
    });

    // 「入力画面に戻る」：入力内容は残したまま、エラー表示だけリセット
    complete.querySelector('.js-form-reset').addEventListener('click', () => {
        state.touched.clear();
        state.tried = false;
        complete.hidden = true;
        form.hidden = false;
        render();
        inputs.name.focus();
    });

    // デザイン確認用：?form=error / ?form=complete で各状態を固定表示
    const preview = new URLSearchParams(location.search).get('form');
    if (preview === 'error') {
        inputs.name.value = '山田 花子';
        inputs.tel.value = '090-12';
        inputs.email.value = 'hanako@';
        ['name', 'tel', 'email', 'd1', 't1'].forEach((name) => state.touched.add(name));
        state.tried = true;
        render();
    } else if (preview === 'complete') {
        inputs.name.value = '山田 花子';
        inputs.d1.value = '2026-10-08';
        inputs.t1.value = '14:00';
        showComplete(getValues());
    }
}
