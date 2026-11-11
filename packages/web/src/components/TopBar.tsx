// 上部バー: 大分類のタブ(プロジェクト / セッション / 履歴 / PR)/ 使用率メーター / MCP の要約 / 承認待ち / 新規セッション
import type { RateWindow } from '@cc-hub/shared';
import { TOP_VIEW_LABEL, type TopView, isFinished, useHub } from '../store';
import { needsAttention, usePrGroups } from '../pr';
import { ALT, MOD, SHIFT, fmtUntil, useNow } from '../util';
import { useApprovalCount } from './Approval';
import { McpSummary } from './Mcp';

function Meter({ label, w, now }: { label: string; w: RateWindow | null; now: number }) {
  if (!w) {
    return (
      <div className="meter" title={`${label}: データなし`}>
        <span className="meter-label">{label}</span>
        <span className="meter-bar">
          <span style={{ width: 0 }} />
        </span>
        <span className="meter-num muted">—</span>
      </div>
    );
  }
  const pct = Math.max(0, Math.min(100, w.pct));
  const tone = pct >= 90 ? 'hot' : pct >= 70 ? 'warm' : '';
  // 回復時刻が分からない(0)ときは残り時間を出さない。過ぎていたら次の値が届くまで「回復済み」
  const until = w.resetsAt ? w.resetsAt - now : null;
  return (
    <div
      className={`meter ${tone}`}
      title={`${label} 使用率 ${Math.round(pct)}%${w.resetsAt ? ` / リセット ${new Date(w.resetsAt).toLocaleString('ja-JP')}` : ''}`}
    >
      <span className="meter-label">{label}</span>
      <span className="meter-bar" role="meter" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
        <span style={{ width: `${pct}%` }} />
      </span>
      <span className="meter-num">{Math.round(pct)}%</span>
      {until != null && <span className="meter-reset">{until > 0 ? `残${fmtUntil(until)}` : '回復済み'}</span>}
    </div>
  );
}

export function UsageMeters({ compact = false }: { compact?: boolean }) {
  const usage = useHub((s) => s.usage);
  const now = useNow(30000);
  return (
    <div className={`meters ${compact ? 'compact' : ''}`}>
      <Meter label="5時間" w={usage?.fiveHour ?? null} now={now} />
      <Meter label="週" w={usage?.sevenDay ?? null} now={now} />
    </div>
  );
}

export function ConnDot() {
  const connected = useHub((s) => s.connected);
  return (
    <span
      className={`conn ${connected ? 'on' : 'off'}`}
      title={connected ? 'デーモンに接続中' : '切断中(再接続しています)'}
      aria-label={connected ? '接続中' : '切断中'}
    />
  );
}

export const TOP_ORDER: TopView[] = ['projects', 'sessions', 'history', 'prs'];

/** 上部の大分類タブ(Alt+1〜4) */
function TopNav() {
  const top = useHub((s) => s.topView);
  const deskView = useHub((s) => s.deskView);
  const setTop = useHub((s) => s.setTopView);
  const sessions = useHub((s) => s.sessions);
  const worktrees = useHub((s) => s.worktrees);
  const active = Object.values(sessions).filter((x) => !isFinished(x, worktrees)).length;
  const g = usePrGroups();
  const prAttn = g.mine.filter(needsAttention).length + g.review.length;
  // スキル / MCP / ゲームの表示中はどのタブも選択中にしない
  const inTop = deskView !== 'skills' && deskView !== 'mcp' && deskView !== 'game' && deskView !== 'settings';
  const badge = (t: TopView) =>
    t === 'sessions' && active > 0 ? (
      <span className="topnav-n" aria-label={`動いているセッション ${active} 件`}>
        {active}
      </span>
    ) : t === 'prs' && prAttn > 0 ? (
      <span className="topnav-n warn" aria-label={`対応が必要な PR ${prAttn} 件`}>
        {prAttn}
      </span>
    ) : null;
  return (
    <nav className="topnav" aria-label="画面の切り替え">
      {TOP_ORDER.map((t, i) => {
        const on = inTop && top === t;
        return (
          <button
            key={t}
            className={`topnav-btn ${on ? 'on' : ''}`}
            aria-current={on ? 'page' : undefined}
            onClick={() => setTop(t)}
            title={`${TOP_VIEW_LABEL[t]}(${ALT}${i + 1})`}
          >
            {TOP_VIEW_LABEL[t]}
            {badge(t)}
          </button>
        );
      })}
    </nav>
  );
}

/** フォーカス(1 セッション)/ 全体(タイル)の切り替え(⌘0) */
function ViewToggle() {
  const view = useHub((s) => s.deskView);
  const setDeskView = useHub((s) => s.setDeskView);
  if (view !== 'session' && view !== 'overview') return null;
  return (
    <div className="topnav view-toggle" role="group" aria-label="表示の切り替え">
      <button className={`topnav-btn ${view === 'session' ? 'on' : ''}`} aria-pressed={view === 'session'} onClick={() => setDeskView('session')}>
        フォーカス
      </button>
      <button
        className={`topnav-btn ${view === 'overview' ? 'on' : ''}`}
        aria-pressed={view === 'overview'}
        onClick={() => setDeskView('overview')}
        title={`全体(${MOD}0)`}
      >
        全体 <kbd>{`${MOD}0`}</kbd>
      </button>
    </div>
  );
}

export function TopBar() {
  const approvals = useApprovalCount();
  const deskView = useHub((s) => s.deskView);
  const openSettings = useHub((s) => s.openSettings);
  const setDeskView = useHub((s) => s.setDeskView);
  const setDrawer = useHub((s) => s.setApprovalDrawer);
  const drawer = useHub((s) => s.approvalDrawer);
  const setNew = useHub((s) => s.setNewSessionOpen);
  return (
    <header className="topbar">
      <div className="brand">
        <ConnDot />
        CC Hub
      </div>
      <TopNav />
      <ViewToggle />
      <UsageMeters />
      <div className="spacer" />
      <McpSummary />
      <button
        className={`btn appr-btn ${approvals > 0 ? 'has' : ''}`}
        onClick={() => setDrawer(!drawer)}
        title={`承認キュー(${MOD}${SHIFT}A)`}
      >
        承認待ち <span className="count">{approvals}</span>
      </button>
      <button
        className={`icon-btn gear-btn ${deskView === 'settings' ? 'on' : ''}`}
        onClick={() => (deskView === 'settings' ? setDeskView('home') : openSettings())}
        title="設定(通知・アップロード先のサーバー・Claude との連携)"
        aria-label="設定"
        aria-current={deskView === 'settings' ? 'page' : undefined}
      >
        ⚙
      </button>
      <button className="btn primary" onClick={() => setNew(true)}>
        + 新規セッション
      </button>
    </header>
  );
}
