// Lưới an toàn UI: một màn hình lỗi khi render không được làm trắng toàn bộ giao diện (trước đây phải F5).
import { Component, type ReactNode } from 'react';
import { useUI } from './store';
import { reportError } from '../telemetry/telemetry';

interface Props { name: string; children: ReactNode; silent?: boolean }
interface State { failed: boolean }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { failed: false };
  static getDerivedStateFromError(): State { return { failed: true }; }
  componentDidCatch(err: unknown) {
    console.error(`[ui:${this.props.name}]`, err);
    reportError('ui', err, { boundary: this.props.name });
    const ui = useUI.getState();
    if (!this.props.silent) ui.toast({ id: `uierr_${this.props.name}`, text: 'Màn hình gặp lỗi và đã đóng · tiến trình vẫn giữ.', severity: 'warning' });
    // đóng overlay lỗi rồi cho phép mở lại ngay
    if (ui.overlay) ui.open(null);
    setTimeout(() => this.setState({ failed: false }), 50);
  }
  render() { return this.state.failed ? null : this.props.children; }
}
