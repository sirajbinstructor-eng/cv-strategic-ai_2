import type { AdminDailyActivity, AdminPlanBreakdown, AdminSubscriptionStatus } from "@/lib/admin/analytics-repository";

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

function ActivityChart({ data }: { data: AdminDailyActivity[] }) {
  const width = 760, height = 270, left = 42, right = 18, top = 20, bottom = 38;
  const values = data.flatMap(item => [item.analyses, item.generations]);
  const max = Math.max(4, ...values);
  const ceiling = Math.ceil(max / 4) * 4;
  const x = (index: number) => left + (index / Math.max(1, data.length - 1)) * (width - left - right);
  const y = (value: number) => top + (1 - value / ceiling) * (height - top - bottom);
  const path = (key: "analyses" | "generations") => data.map((item, index) => `${index === 0 ? "M" : "L"} ${x(index)} ${y(item[key])}`).join(" ");
  const area = `${path("analyses")} L ${x(data.length - 1)} ${height - bottom} L ${x(0)} ${height - bottom} Z`;
  const tickIndexes = [0, 7, 14, 21, 29].filter(index => index < data.length);
  return <div className="admin-chart-svg-wrap">
    <svg className="admin-activity-svg" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Daily completed analyses and CV generations over the last 30 days">
      <defs>
        <linearGradient id="admin-activity-fill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#4777c8" stopOpacity=".19"/><stop offset="100%" stopColor="#4777c8" stopOpacity="0"/></linearGradient>
      </defs>
      {[0,1,2,3,4].map(tick => {
        const value = ceiling * tick / 4;
        return <g key={tick}><line x1={left} x2={width-right} y1={y(value)} y2={y(value)} stroke="#e9eef5" strokeDasharray="4 5"/><text x={left-10} y={y(value)+4} textAnchor="end" fontSize="10" fill="#98a4b5">{Math.round(value)}</text></g>;
      })}
      <path d={area} fill="url(#admin-activity-fill)"/>
      <path d={path("analyses")} fill="none" stroke="#4777c8" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
      <path d={path("generations")} fill="none" stroke="#17a18b" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
      {data.map((item,index) => index % 5 === 0 || index === data.length - 1 ? <g key={index}>
        <circle cx={x(index)} cy={y(item.analyses)} r="4" fill="#fff" stroke="#4777c8" strokeWidth="2"><title>{item.label}: {formatNumber(item.analyses)} analyses</title></circle>
        <circle cx={x(index)} cy={y(item.generations)} r="4" fill="#fff" stroke="#17a18b" strokeWidth="2"><title>{item.label}: {formatNumber(item.generations)} CV generations</title></circle>
      </g> : null)}
      {tickIndexes.map(index => <text key={index} x={x(index)} y={height-11} textAnchor="middle" fontSize="10" fill="#98a4b5">{data[index]?.label}</text>)}
    </svg>
  </div>;
}

function SignupBars({ data }: { data: AdminDailyActivity[] }) {
  const groups = Array.from({ length: 6 }, (_, index) => {
    const slice = data.slice(index * 5, index * 5 + 5);
    return { label: slice[0]?.label || "", total: slice.reduce((sum, day) => sum + day.signups, 0) };
  });
  const max = Math.max(1, ...groups.map(item => item.total));
  return <div className="admin-signup-bars">
    {groups.map((group,index) => <div className="admin-signup-bar-column" key={index}>
      <div className="admin-signup-bar-track"><div className="admin-signup-bar-fill" style={{ height: `${Math.max(group.total ? 8 : 0, group.total / max * 100)}%` }} title={`${group.total} new accounts`}/></div>
      <strong>{formatNumber(group.total)}</strong><small>{group.label}</small>
    </div>)}
  </div>;
}

function PlanDonut({ plans }: { plans: AdminPlanBreakdown[] }) {
  const pro = plans.find(item => item.plan === "pro")?.total || 0;
  const consultant = plans.find(item => item.plan === "consultant")?.total || 0;
  const total = pro + consultant;
  const circumference = 2 * Math.PI * 42;
  const proLength = total ? pro / total * circumference : 0;
  const consultantLength = total ? consultant / total * circumference : 0;
  return <div className="admin-plan-donut-layout">
    <div className="admin-donut-wrap">
      <svg viewBox="0 0 120 120" role="img" aria-label={`Active subscriptions: ${pro} Pro and ${consultant} Gold`}>
        <circle cx="60" cy="60" r="42" fill="none" stroke="#edf1f6" strokeWidth="13"/>
        {total > 0 && <>
          <circle cx="60" cy="60" r="42" fill="none" stroke="#4777c8" strokeWidth="13" strokeDasharray={`${proLength} ${circumference-proLength}`} transform="rotate(-90 60 60)"/>
          <circle cx="60" cy="60" r="42" fill="none" stroke="#17a18b" strokeWidth="13" strokeDasharray={`${consultantLength} ${circumference-consultantLength}`} strokeDashoffset={-proLength} transform="rotate(-90 60 60)"/>
        </>}
        <text x="60" y="56" textAnchor="middle" fontSize="22" fontWeight="800" fill="#172943">{formatNumber(total)}</text>
        <text x="60" y="72" textAnchor="middle" fontSize="8" fill="#8794a7">ACTIVE</text>
      </svg>
    </div>
    <div className="admin-plan-legend">
      <div><i className="admin-legend-dot admin-legend-dot--pro"/><span>Pro</span><strong>{formatNumber(pro)}</strong></div>
      <div><i className="admin-legend-dot admin-legend-dot--consultant"/><span>Gold</span><strong>{formatNumber(consultant)}</strong></div>
      {!total && <p>No active subscriptions yet. This chart will populate as verified subscriptions become active.</p>}
    </div>
  </div>;
}

function StatusBars({ statuses }: { statuses: AdminSubscriptionStatus[] }) {
  const labels: Record<string,string> = { active:"Active", canceled_at_period_end:"Cancel at period end", past_due:"Past due", pending:"Pending", expired:"Expired", refunded:"Refunded", disputed:"Disputed" };
  const colors: Record<string,string> = { active:"admin-status-fill--active", canceled_at_period_end:"admin-status-fill--scheduled", past_due:"admin-status-fill--warning", pending:"admin-status-fill--pending", expired:"admin-status-fill--muted", refunded:"admin-status-fill--muted", disputed:"admin-status-fill--danger" };
  const max = Math.max(1,...statuses.map(item=>item.total));
  return <div className="admin-status-list">
    {statuses.length ? statuses.map(item=><div className="admin-status-row" key={item.status}>
      <div className="admin-status-label"><span>{labels[item.status] || item.status}</span><strong>{formatNumber(item.total)}</strong></div>
      <div className="admin-status-track"><div className={`admin-status-fill ${colors[item.status] || "admin-status-fill--muted"}`} style={{width:`${item.total/max*100}%`}}/></div>
    </div>) : <p className="admin-chart-empty">No subscription records yet.</p>}
  </div>;
}

export function AdminAnalytics({ data }: { data: {
  users: { total:number; new30d:number; new7d:number };
  activity: { analysesAll:number; generationsAll:number };
  subscriptions: { active:number; pastDue:number; pending:number; total:number };
  pendingDiscounts:number;
  daily:AdminDailyActivity[];
  plans:AdminPlanBreakdown[];
  statuses:AdminSubscriptionStatus[];
} }) {
  const cards = [
    {label:"Total accounts",value:data.users.total,detail:`+${formatNumber(data.users.new30d)} in the last 30 days`,tone:"blue",icon:"◉"},
    {label:"Active subscriptions",value:data.subscriptions.active,detail:`${formatNumber(data.subscriptions.pastDue)} past due · ${formatNumber(data.subscriptions.pending)} pending`,tone:"green",icon:"↗"},
    {label:"Completed analyses",value:data.activity.analysesAll,detail:"All-time successful usage",tone:"violet",icon:"⌁"},
    {label:"CV generations",value:data.activity.generationsAll,detail:"All-time successful usage",tone:"amber",icon:"▤"}
  ];
  return <div className="admin-analytics">
    <section className="admin-kpi-grid">
      {cards.map(card=><article className="admin-kpi-card" key={card.label}>
        <div className="admin-kpi-top"><span>{card.label}</span><i className={`admin-kpi-icon admin-kpi-icon--${card.tone}`}>{card.icon}</i></div>
        <strong>{formatNumber(card.value)}</strong><small>{card.detail}</small>
      </article>)}
    </section>
    <section className="admin-analytics-grid admin-analytics-grid--main">
      <article className="admin-visual-card admin-visual-card--wide">
        <div className="admin-visual-heading"><div><p className="admin-visual-eyebrow">PRODUCT USAGE</p><h2>Activity overview</h2><p>Successful analyses and CV generations over the last 30 days</p></div><span className="admin-period-pill">LAST 30 DAYS</span></div>
        <div className="admin-chart-legend"><span><i className="admin-legend-dot admin-legend-dot--pro"/> Analyses</span><span><i className="admin-legend-dot admin-legend-dot--consultant"/> CV generations</span></div>
        <ActivityChart data={data.daily}/>
      </article>
      <article className="admin-visual-card">
        <div className="admin-visual-heading"><div><p className="admin-visual-eyebrow">CUSTOMER MIX</p><h2>Active plans</h2><p>Current paid candidate subscriptions</p></div></div>
        <PlanDonut plans={data.plans}/>
        <div className="admin-visual-divider"/>
        <p className="admin-mini-heading">Subscription lifecycle</p>
        <StatusBars statuses={data.statuses}/>
      </article>
    </section>
    <section className="admin-analytics-grid admin-analytics-grid--secondary">
      <article className="admin-visual-card">
        <div className="admin-visual-heading"><div><p className="admin-visual-eyebrow">ACQUISITION</p><h2>New accounts</h2><p>Sign-ups grouped into five-day windows</p></div><span className="admin-period-pill">30 DAYS</span></div>
        <SignupBars data={data.daily}/>
        <div className="admin-signup-summary"><strong>{formatNumber(data.users.new30d)}</strong><span>new accounts in the last 30 days</span><small>{formatNumber(data.users.new7d)} in the last 7 days</small></div>
      </article>
      <article className="admin-visual-card admin-admin-queue-card">
        <div className="admin-visual-heading"><div><p className="admin-visual-eyebrow">OPERATIONS</p><h2>Items needing attention</h2><p>Queues requiring administrator review</p></div></div>
        <div className="admin-queue-stat"><span className="admin-queue-icon admin-queue-icon--amber">%</span><div><strong>{formatNumber(data.pendingDiscounts)}</strong><span>Discount applications awaiting review</span></div><a href="/admin/discounts">Review →</a></div>
        <div className="admin-queue-stat"><span className="admin-queue-icon admin-queue-icon--blue">↗</span><div><strong>{formatNumber(data.subscriptions.pastDue)}</strong><span>Subscriptions marked past due</span></div><a href="/admin/subscriptions">Inspect →</a></div>
        <div className="admin-queue-stat"><span className="admin-queue-icon admin-queue-icon--green">◎</span><div><strong>{formatNumber(data.users.new7d)}</strong><span>New accounts in the last 7 days</span></div><a href="/admin/users">View users →</a></div>
      </article>
    </section>
    <p className="admin-data-footnote">Live figures from the application database. Usage charts count completed operations only; subscription totals are not reported as revenue. All dates use the database server timezone.</p>
  </div>;
}
