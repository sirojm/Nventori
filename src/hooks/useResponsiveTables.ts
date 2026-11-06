import { useEffect } from 'react';

/**
 * On phones, tables marked with class "rt" are shown as cards (see index.css).
 * That layout needs each cell to know its column title, so copy the <th> text onto every <td>
 * (as data-label) and keep it updated as rows are rendered or change.
 */
export const useResponsiveTables = () => {
  useEffect(() => {
    let frame = 0;

    const label = () => {
      frame = 0;
      document.querySelectorAll<HTMLTableElement>('table.rt').forEach((table) => {
        const heads = Array.from(table.querySelectorAll('thead th')).map((th) => (th.textContent || '').trim());
        table.querySelectorAll('tbody tr').forEach((row) => {
          Array.from(row.children).forEach((cell, index) => {
            if (!(cell instanceof HTMLElement) || cell.tagName !== 'TD') return;
            if (cell.hasAttribute('colspan')) return;
            const text = heads[index] ?? '';
            if (cell.dataset.label !== text) cell.dataset.label = text;
            const isAction = /^(aksi|label qr)$/i.test(text);
            if (isAction && cell.dataset.action !== '1') cell.dataset.action = '1';
          });
        });
      });
    };

    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(label);
    };

    label();
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => {
      observer.disconnect();
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);
};
