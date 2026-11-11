// 全体(⌘0): 動いているセッション(= 作業ツリーごとのエージェント)をタイルで並べ、どれが自分を待っているかを一目で見る。
// 承認待ちのタイルはその場で答えられる。タイルを押すとそのセッションを開く(⌘1〜9 も同じ順)
import type { SessionInfo } from '@cc-hub/shared';
import { orderedSessions, useHub } from '../store';
import { MOD, STATUS_ICON, STATUS_LABEL, fmtAgo, projectLabel, useNow } from '../util';
import { ApprovalButtons } from './Approval';

/** タイルの中身: 何をしているか(承認の質問 / 使っているツール / 直近の発言) */
function TileBody({ s, now }: { s: SessionInfo; now: number }) {
  if (s.status === 'awaiting_approval' && s.approval) {
    return (
      <>
        <div className="ov-q mono">{s.approval.question}</div>
        <div className="ov-appr" onClick={(e) => e.stopPropagation()}>
          <ApprovalButtons session={s} />
        </div>
      </>
    );
  }
  if (s.currentTool) {
    return (
      <div className="ov-q mono">
        <span className="ov-tool">{s.currentTool.name}</span> {s.currentTool.target}
      </div>
    );
  }
  return <div className="ov-q">{s.lastMessage || s.task || <span className="muted">最後の操作: {fmtAgo(s.lastEventAt, now)}</span>}</div>;
}

function Tile({ s, index, repoName, now }: { s: SessionInfo; index: number; repoName: string; now: number }) {
  const open = useHub((st) => st.open);
  const pct = s.contextPct == null ? null : Math.max(0, Math.min(100, Math.round(s.contextPct)));
  return (
    <div
      className={`ov-tile st-${s.status}`}
      role="button"
      tabIndex={0}
      onClick={() => open(s.id)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && e.target === e.currentTarget) open(s.id);
      }}
      aria-label={`${s.name}(${STATUS_LABEL[s.status]})を開く`}
    >
      <div className="ov-head">
        <span className={`ov-status st-${s.status}`}>
          <span className="srow-ico" aria-hidden="true">
            {STATUS_ICON[s.status]}
          </span>
        </span>
        <span className="ov-name">{s.name}</span>
        <span className={`ov-label st-${s.status}`}>{STATUS_LABEL[s.status]}</span>
      </div>
      <div className="ov-where mono" title={s.cwd}>
        {repoName}
        {s.branch ? ` / ${s.branch}` : ''}
      </div>
      <div className="ov-body">
        <TileBody s={s} now={now} />
      </div>
      <div className="ov-foot">
        {pct != null && (
          <span className="ov-ctx" title={`コンテキスト ${pct}%`}>
            <span className="ov-ctx-bar">
              <span style={{ width: `${pct}%` }} />
            </span>
            {pct}%
          </span>
        )}
        <span className="spacer" />
        {index < 9 && <kbd>{`${MOD}${index + 1}`}</kbd>}
      </div>
    </div>
  );
}

export function Overview() {
  const sessions = useHub((s) => s.sessions);
  const repos = useHub((s) => s.repos);
  const worktrees = useHub((s) => s.worktrees);
  const sortOpts = useHub((s) => s.sortOpts);
  const setNew = useHub((s) => s.setNewSessionOpen);
  const now = useNow(30000);
  const list = orderedSessions(sessions, repos, worktrees, sortOpts);
  const waiting = list.filter((s) => s.status === 'awaiting_approval').length;
  const repoCount = new Set(list.map((s) => s.repoId ?? s.cwd)).size;
  return (
    <div className="repo-scroll">
      <div className="ov-page">
        <div className="ov-title">
          <h2>全体</h2>
          <span className="muted">
            {list.length} エージェント · {repoCount} プロジェクト
            {waiting > 0 && <span className="ov-waiting"> · 承認待ち {waiting}</span>}
          </span>
          <span className="spacer" />
          <span className="muted small">{`${MOD}1〜9 で開く · ${MOD}0 で全体に戻る`}</span>
        </div>
        <div className="ov-grid">
          {list.map((s, i) => (
            <Tile
              key={s.id}
              s={s}
              index={i}
              now={now}
              repoName={(s.repoId && repos[s.repoId]?.name) || projectLabel(s.cwd)}
            />
          ))}
          <button className="ov-tile ov-new" onClick={() => setNew(true)}>
            <span className="ov-new-plus" aria-hidden="true">
              +
            </span>
            新しいエージェント
            <span className="muted small">プロジェクトを選んで、専用の作業ツリーで起動します</span>
          </button>
        </div>
      </div>
    </div>
  );
}
