import React, { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  ChevronDown,
  Clock3,
  Inbox,
  Megaphone,
  MessageSquareReply,
  Send,
  Trash2,
} from 'lucide-react';
import { AnnouncementItem, FeedbackItem } from './types';
import {
  EmptyData,
  HorizontalBars,
  LineChart,
  Panel,
  StatCard,
  StatusPill,
  TableFrame,
  formatNumber,
  tableCellClass,
  tableHeadClass,
  tableRowClass,
} from './AdminUI';

interface AdminAnnouncementsProps {
  announcements: AnnouncementItem[];
  feedbackList: FeedbackItem[];
  onCreateAnnouncement: (e: React.FormEvent, title: string, message: string, type: 'info' | 'warning' | 'success') => void;
  onDeleteAnnouncement: (id: string) => void;
  onReplyFeedback: (id: string, text?: string) => void;
}

const feedbackTone = (status: FeedbackItem['status']): 'mint' | 'violet' | 'amber' | 'slate' => {
  if (status === 'resolved' || status === 'closed') return 'mint';
  if (status === 'in_review') return 'violet';
  if (status === 'open') return 'amber';
  return 'slate';
};

const announcementTone = (type: AnnouncementItem['type']): 'mint' | 'violet' | 'amber' | 'slate' => {
  if (type === 'success') return 'mint';
  if (type === 'warning') return 'amber';
  if (type === 'info' || type === 'banner') return 'violet';
  return 'slate';
};

const formatAge = (createdAt: string) => {
  const elapsed = Date.now() - new Date(createdAt).getTime();
  if (!Number.isFinite(elapsed) || elapsed < 0) return 'Just now';
  const minutes = Math.floor(elapsed / 60000);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ${minutes % 60}m`;
  return `${Math.floor(hours / 24)}d`;
};

export const AdminAnnouncements: React.FC<AdminAnnouncementsProps> = ({
  announcements,
  feedbackList,
  onCreateAnnouncement,
  onDeleteAnnouncement,
  onReplyFeedback,
}) => {
  const [newAnnTitle, setNewAnnTitle] = useState('');
  const [newAnnMessage, setNewAnnMessage] = useState('');
  const [newAnnType, setNewAnnType] = useState<'info' | 'warning' | 'success'>('info');
  const [selectedTicket, setSelectedTicket] = useState<FeedbackItem | null>(feedbackList[0] || null);
  const [replyText, setReplyText] = useState('');

  useEffect(() => {
    if (feedbackList.length === 0) {
      setSelectedTicket(null);
      return;
    }
    const refreshedSelection = selectedTicket ? feedbackList.find((item) => item._id === selectedTicket._id) : null;
    setSelectedTicket(refreshedSelection || feedbackList[0] || null);
    // The selection should only be reconciled when the server-provided ticket collection changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [feedbackList]);

  const openCount = feedbackList.filter((item) => item.status === 'open').length;
  const reviewCount = feedbackList.filter((item) => item.status === 'in_review').length;
  const resolvedCount = feedbackList.filter((item) => item.status === 'resolved' || item.status === 'closed').length;
  const repliedCount = feedbackList.filter((item) => Boolean(item.reply)).length;
  const activeAnnouncements = announcements.filter((announcement) => announcement.isActive);

  const categoryCounts = useMemo(() => {
    const counts = feedbackList.reduce<Record<string, number>>((result, item) => {
      const category = item.category || 'Other';
      result[category] = (result[category] || 0) + 1;
      return result;
    }, {});
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [feedbackList]);

  const volumeByDate = useMemo(() => {
    const counts = new Map<string, { date: Date; count: number }>();
    feedbackList.forEach((item) => {
      const date = new Date(item.createdAt);
      if (Number.isNaN(date.getTime())) return;
      const key = date.toISOString().slice(0, 10);
      const current = counts.get(key);
      counts.set(key, { date, count: (current?.count || 0) + 1 });
    });
    return [...counts.values()].sort((a, b) => a.date.getTime() - b.date.getTime()).slice(-10);
  }, [feedbackList]);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!newAnnTitle.trim() || !newAnnMessage.trim()) return;
    onCreateAnnouncement(event, newAnnTitle.trim(), newAnnMessage.trim(), newAnnType);
    setNewAnnTitle('');
    setNewAnnMessage('');
  };

  const handleReply = (message: string) => {
    if (!selectedTicket || !message.trim()) return;
    onReplyFeedback(selectedTicket._id, message.trim());
    setReplyText('');
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <StatCard label="Open tickets" value={formatNumber(openCount)} detail="Awaiting review" icon={<Inbox className="h-[18px] w-[18px]" />} tone={openCount > 0 ? 'amber' : 'slate'} />
        <StatCard label="In review" value={formatNumber(reviewCount)} detail="Currently being handled" icon={<Clock3 className="h-[18px] w-[18px]" />} tone="violet" />
        <StatCard label="Resolved" value={formatNumber(resolvedCount)} detail="In the current dataset" icon={<CheckCircle2 className="h-[18px] w-[18px]" />} tone="mint" />
        <StatCard label="Active banners" value={formatNumber(activeAnnouncements.length)} detail={`${announcements.length} total announcements`} icon={<Megaphone className="h-[18px] w-[18px]" />} tone="violet" />
        <StatCard label="Tickets answered" value={formatNumber(repliedCount)} detail={`${feedbackList.length > 0 ? ((repliedCount / feedbackList.length) * 100).toFixed(1) : '0.0'}% reply coverage`} icon={<MessageSquareReply className="h-[18px] w-[18px]" />} tone="mint" />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <div className="space-y-4 xl:col-span-7">
          <Panel title="Support ticket queue" subtitle="Student feedback ordered by the server response" bodyClassName="p-0">
            <TableFrame className="rounded-none border-0">
              <table className="w-full min-w-[720px] text-left">
                <thead className={tableHeadClass}>
                  <tr>
                    <th scope="col" className={tableCellClass}>Requester</th>
                    <th scope="col" className={tableCellClass}>Message</th>
                    <th scope="col" className={tableCellClass}>Category</th>
                    <th scope="col" className={tableCellClass}>Status</th>
                    <th scope="col" className={`${tableCellClass} text-right`}>Age</th>
                  </tr>
                </thead>
                <tbody>
                  {feedbackList.length === 0 ? (
                    <tr><td colSpan={5} className="px-4 py-12 text-center text-xs text-slate-500">No student support tickets found.</td></tr>
                  ) : feedbackList.map((item) => (
                    <tr
                      key={item._id}
                      className={`${tableRowClass} cursor-pointer ${selectedTicket?._id === item._id ? 'bg-[#64ffda]/[0.035]' : ''}`}
                      onClick={() => setSelectedTicket(item)}
                    >
                      <td className={`${tableCellClass} max-w-[180px] truncate font-medium text-slate-200`} title={item.email}>{item.email}</td>
                      <td className={`${tableCellClass} max-w-[280px] truncate text-slate-400`} title={item.message}>{item.message}</td>
                      <td className={tableCellClass}><StatusPill label={item.category || 'Other'} tone="slate" /></td>
                      <td className={tableCellClass}><StatusPill label={item.status.replace('_', ' ')} tone={feedbackTone(item.status)} dot /></td>
                      <td className={`${tableCellClass} text-right text-slate-500 tabular-nums`}>{formatAge(item.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableFrame>
          </Panel>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Panel title="Ticket volume" subtitle="Created support tickets over time">
              {volumeByDate.length > 0 ? (
                <LineChart
                  labels={volumeByDate.map((item) => item.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }))}
                  series={[{ name: 'Tickets', values: volumeByDate.map((item) => item.count), color: '#64ffda', fill: true }]}
                  ariaLabel="Support ticket volume over time"
                  height={190}
                  valueFormatter={(value) => Math.round(value).toString()}
                />
              ) : <EmptyData title="No ticket volume data" />}
            </Panel>
            <Panel title="Tickets by category" subtitle="Current feedback collection">
              <HorizontalBars
                data={categoryCounts.slice(0, 6).map(([label, value], index) => ({ label, value, color: index % 2 === 0 ? '#a78bfa' : '#64ffda' }))}
                ariaLabel="Support tickets grouped by category"
                emptyMessage="No ticket category data"
              />
            </Panel>
          </div>

          <Panel title={selectedTicket ? `Reply to ${selectedTicket.email}` : 'Ticket reply'} subtitle={selectedTicket ? selectedTicket.message : 'Select a ticket from the queue'}>
            {selectedTicket ? (
              selectedTicket.reply ? (
                <div className="rounded-lg border border-[#64ffda]/15 bg-[#64ffda]/[0.05] p-4">
                  <div className="flex items-center gap-2 text-xs font-semibold text-[#9affe6]"><CheckCircle2 className="h-4 w-4" aria-hidden="true" />Admin reply</div>
                  <p className="mt-2 text-xs leading-6 text-slate-300">{selectedTicket.reply}</p>
                </div>
              ) : (
                <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_260px]">
                  <div>
                    <label htmlFor="support-reply" className="mb-1.5 block text-xs font-medium text-slate-400">Reply message</label>
                    <textarea
                      id="support-reply"
                      value={replyText}
                      onChange={(event) => setReplyText(event.target.value)}
                      rows={5}
                      placeholder="Write a clear response to the student…"
                      className="w-full resize-none rounded-lg border border-[#2b3745] bg-[#0d141d] px-3 py-2.5 text-sm leading-6 text-slate-200 outline-none placeholder:text-slate-600 focus:border-[#64ffda]/50 focus:ring-2 focus:ring-[#64ffda]/10"
                    />
                    <div className="mt-3 flex justify-end">
                      <button type="button" disabled={!replyText.trim()} onClick={() => handleReply(replyText)} className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-[#64ffda] px-4 text-xs font-semibold text-[#07110f] hover:bg-[#8affe2] disabled:cursor-not-allowed disabled:opacity-40"><Send className="h-4 w-4" aria-hidden="true" />Send reply</button>
                    </div>
                  </div>
                  <div>
                    <p className="mb-1.5 text-xs font-medium text-slate-400">Saved responses</p>
                    <div className="space-y-2">
                      <button type="button" onClick={() => handleReply('Thank you for reporting this. We have resolved the issue.')} className="w-full rounded-lg border border-[#273241] bg-[#0c131b] p-3 text-left text-xs text-slate-300 hover:border-[#3a4858] hover:text-white">
                        <strong className="block font-medium">Resolved issue</strong>
                        <span className="mt-1 block text-[11px] leading-4 text-slate-500">Confirm that the reported problem is fixed.</span>
                      </button>
                      <button type="button" onClick={() => handleReply('Your feature request has been forwarded to our engineering team. Thank you for the feedback.')} className="w-full rounded-lg border border-[#273241] bg-[#0c131b] p-3 text-left text-xs text-slate-300 hover:border-[#3a4858] hover:text-white">
                        <strong className="block font-medium">Feature received</strong>
                        <span className="mt-1 block text-[11px] leading-4 text-slate-500">Acknowledge and route a feature request.</span>
                      </button>
                    </div>
                  </div>
                </div>
              )
            ) : <EmptyData title="Select a support ticket" detail="The selected ticket and reply controls will appear here." />}
          </Panel>
        </div>

        <div className="space-y-4 xl:col-span-5">
          <Panel title="Broadcast announcement" subtitle="Create a banner for active students">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="announcement-title" className="mb-1.5 block text-xs font-medium text-slate-400">Banner title</label>
                <input id="announcement-title" value={newAnnTitle} onChange={(event) => setNewAnnTitle(event.target.value)} placeholder="Scheduled maintenance" className="h-11 w-full rounded-lg border border-[#2b3745] bg-[#0d141d] px-3 text-sm text-slate-200 outline-none placeholder:text-slate-600 focus:border-[#64ffda]/50 focus:ring-2 focus:ring-[#64ffda]/10" />
              </div>
              <div>
                <label htmlFor="announcement-message" className="mb-1.5 block text-xs font-medium text-slate-400">Message</label>
                <textarea id="announcement-message" value={newAnnMessage} onChange={(event) => setNewAnnMessage(event.target.value)} rows={4} placeholder="Explain what students need to know…" className="w-full resize-none rounded-lg border border-[#2b3745] bg-[#0d141d] px-3 py-2.5 text-sm leading-6 text-slate-200 outline-none placeholder:text-slate-600 focus:border-[#64ffda]/50 focus:ring-2 focus:ring-[#64ffda]/10" />
              </div>
              <label className="relative block">
                <span className="mb-1.5 block text-xs font-medium text-slate-400">Announcement type</span>
                <select value={newAnnType} onChange={(event) => setNewAnnType(event.target.value as 'info' | 'warning' | 'success')} className="h-11 w-full appearance-none rounded-lg border border-[#2b3745] bg-[#0d141d] px-3 pr-10 text-sm text-slate-300 outline-none focus:border-[#64ffda]/50">
                  <option value="info">Information</option>
                  <option value="warning">Warning</option>
                  <option value="success">Success</option>
                </select>
                <ChevronDown className="pointer-events-none absolute bottom-3.5 right-3 h-4 w-4 text-slate-500" aria-hidden="true" />
              </label>

              <div>
                <p className="mb-1.5 text-xs font-medium text-slate-400">Student banner preview</p>
                <div className="rounded-lg border border-[#a78bfa]/25 bg-[#a78bfa]/[0.08] p-4">
                  <div className="flex items-start gap-3">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-[#a78bfa]/20 bg-[#a78bfa]/10 text-[#c4b5fd]"><Megaphone className="h-4 w-4" aria-hidden="true" /></span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-100">{newAnnTitle || 'Announcement title'}</p>
                      <p className="mt-1 text-xs leading-5 text-slate-400">{newAnnMessage || 'Your message preview will appear here.'}</p>
                    </div>
                  </div>
                </div>
              </div>
              <button type="submit" disabled={!newAnnTitle.trim() || !newAnnMessage.trim()} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-[#64ffda] px-4 text-xs font-semibold text-[#07110f] hover:bg-[#8affe2] disabled:cursor-not-allowed disabled:opacity-40"><Send className="h-4 w-4" aria-hidden="true" />Broadcast now</button>
            </form>
          </Panel>

          <Panel title={`Active banners (${activeAnnouncements.length})`} subtitle="Currently published student announcements">
            {activeAnnouncements.length === 0 ? (
              <EmptyData title="No active banners" detail="Published announcements will appear here." />
            ) : (
              <div className="divide-y divide-[#273241]">
                {activeAnnouncements.map((announcement) => (
                  <div key={announcement._id} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
                    <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-[#64ffda]" aria-hidden="true" />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-xs font-semibold text-slate-200">{announcement.title}</p>
                        <StatusPill label={announcement.type} tone={announcementTone(announcement.type)} />
                      </div>
                      <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">{announcement.message}</p>
                      <time className="mt-1.5 block text-[10px] text-slate-600">{new Date(announcement.createdAt).toLocaleString()}</time>
                    </div>
                    <button type="button" aria-label={`Delete announcement ${announcement.title}`} onClick={() => { if (window.confirm('Delete this announcement?')) onDeleteAnnouncement(announcement._id); }} className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-rose-400/20 text-rose-300 hover:bg-rose-400/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-300/70"><Trash2 className="h-4 w-4" aria-hidden="true" /></button>
                  </div>
                ))}
              </div>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
};
