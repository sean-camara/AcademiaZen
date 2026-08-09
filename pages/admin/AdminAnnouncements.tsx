import React, { useState } from 'react';
import { Info, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { AnnouncementItem, FeedbackItem, CustomSelectOption } from './types';
import { CustomSelect } from './CustomSelect';

interface AdminAnnouncementsProps {
  announcements: AnnouncementItem[];
  feedbackList: FeedbackItem[];
  onCreateAnnouncement: (e: React.FormEvent, title: string, message: string, type: 'info' | 'warning' | 'success') => void;
  onDeleteAnnouncement: (id: string) => void;
  onReplyFeedback: (id: string, text?: string) => void;
}

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
  const [replyText, setReplyText] = useState<{ [id: string]: string }>({});

  const annTypeOptions: CustomSelectOption[] = [
    { value: 'info', label: 'Info (Blue)', icon: <Info className="w-3.5 h-3.5 text-blue-400" /> },
    { value: 'warning', label: 'Warning (Amber)', icon: <AlertTriangle className="w-3.5 h-3.5 text-amber-400" /> },
    { value: 'success', label: 'Success (Green)', icon: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> },
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAnnTitle.trim() || !newAnnMessage.trim()) return;
    onCreateAnnouncement(e, newAnnTitle, newAnnMessage, newAnnType);
    setNewAnnTitle('');
    setNewAnnMessage('');
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-fade-in">
      <div className="p-6 rounded-xl border border-slate-800 bg-[#0c121e] space-y-4">
        <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-300">Broadcast Platform Announcement</h3>

        {(newAnnTitle || newAnnMessage) && (
          <div className="p-3.5 rounded-xl bg-slate-900 border border-emerald-500/30 text-center text-xs font-medium text-emerald-200">
            <span className="text-[10px] uppercase font-bold text-emerald-400 block mb-1">📢 Live Student Banner Preview</span>
            <span>
              <strong>{newAnnTitle || 'Title'}:</strong> {newAnnMessage || 'Message content'}
            </span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Banner Title</label>
            <input
              type="text"
              placeholder="e.g. Scheduled Maintenance or New Feature!"
              value={newAnnTitle}
              onChange={(e) => setNewAnnTitle(e.target.value)}
              className="w-full px-4 py-2 rounded-lg bg-[#0e1626] border border-slate-700/60 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-400/80"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Message Content</label>
            <textarea
              rows={3}
              placeholder="Message details shown to all active students..."
              value={newAnnMessage}
              onChange={(e) => setNewAnnMessage(e.target.value)}
              className="w-full px-4 py-2 rounded-lg bg-[#0e1626] border border-slate-700/60 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-400/80"
            />
          </div>
          <div className="flex items-center justify-between">
            <CustomSelect
              value={newAnnType}
              options={annTypeOptions}
              onChange={(val) => setNewAnnType(val as any)}
            />
            <button
              type="submit"
              className="px-5 py-2 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-semibold text-xs uppercase tracking-wider hover:bg-emerald-500/30 transition"
            >
              Broadcast Now
            </button>
          </div>
        </form>

        <div className="mt-6 border-t border-slate-800 pt-4 space-y-3">
          <h4 className="text-xs font-mono font-bold uppercase text-slate-400">Active Banners</h4>
          {announcements.length === 0 ? (
            <p className="text-xs text-slate-500 font-mono">No active announcement banners.</p>
          ) : (
            announcements.map((ann) => (
              <div key={ann._id} className="p-3 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-between text-xs">
                <div>
                  <p className="font-semibold text-white">{ann.title}</p>
                  <p className="text-slate-400 text-[11px]">{ann.message}</p>
                </div>
                <button
                  onClick={() => onDeleteAnnouncement(ann._id)}
                  className="text-rose-400 hover:text-rose-300 text-xs px-2 py-1"
                >
                  Delete
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="p-6 rounded-xl border border-slate-800 bg-[#0c121e]">
        <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-300 mb-4">Student Support Tickets</h3>
        <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2">
          {feedbackList.length === 0 ? (
            <p className="text-xs text-slate-500 font-mono">No student support tickets open.</p>
          ) : (
            feedbackList.map((item) => (
              <div key={item._id} className="p-4 rounded-lg bg-slate-900 border border-slate-800 text-xs space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-emerald-300 text-[11px]">{item.email}</span>
                  <span className="px-2 py-0.5 rounded text-[9px] font-bold uppercase bg-slate-800 text-slate-300">
                    {item.category}
                  </span>
                </div>
                <p className="text-slate-200">{item.message}</p>
                {item.reply ? (
                  <div className="mt-2 p-2.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-[11px]">
                    <strong>Admin Reply:</strong> {item.reply}
                  </div>
                ) : (
                  <div className="space-y-2 mt-2">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Type reply to student..."
                        value={replyText[item._id] || ''}
                        onChange={(e) => setReplyText({ ...replyText, [item._id]: e.target.value })}
                        className="flex-1 px-3 py-1.5 rounded bg-[#0e1626] border border-slate-700/60 text-xs text-white"
                      />
                      <button
                        onClick={() => onReplyFeedback(item._id, replyText[item._id])}
                        className="px-3 py-1.5 rounded bg-emerald-500/20 text-emerald-300 font-bold text-xs uppercase"
                      >
                        Send
                      </button>
                    </div>
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => onReplyFeedback(item._id, 'Thank you for reporting this! We have resolved the issue.')}
                        className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-400 hover:text-white"
                      >
                        Canned: Resolved Issue
                      </button>
                      <button
                        onClick={() => onReplyFeedback(item._id, 'Your feature request has been forwarded to our engineering team!')}
                        className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-400 hover:text-white"
                      >
                        Canned: Feature Received
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
