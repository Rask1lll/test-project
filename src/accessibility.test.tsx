import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import axe from 'axe-core';
import App from './App';

it('uses permitted ARIA labels on login, message statuses and the typing indicator', async () => {
  const fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
  const user = userEvent.setup();
  const { container } = render(<App />);
  const checkLabels = async () => {
    const result = await axe.run(container, {
      runOnly: { type: 'rule', values: ['aria-prohibited-attr'] },
    });
    expect(result.violations).toEqual([]);
  };
  await checkLabels();
  await user.click(screen.getByRole('button', { name: 'Открыть демо-чат' }));
  expect(screen.getAllByRole('img', { name: 'Прочитано' })).toHaveLength(2);
  await checkLabels();
  await user.type(screen.getByRole('textbox', { name: 'Сообщение' }), 'Проверка доступности');
  await user.click(screen.getByRole('button', { name: 'Отправить сообщение' }));
  expect(screen.getByRole('status')).toHaveTextContent('Собеседник печатает');
  await checkLabels();
  expect(fetchMock).not.toHaveBeenCalled();
});
