import React from 'react';
import { Award, BarChart3, BookOpen, GraduationCap, Target, TrendingUp } from 'lucide-react';
import { AcademicAnalytics } from './types';
import {
  DonutChart,
  EmptyData,
  HorizontalBars,
  Panel,
  StatCard,
  StatusPill,
  formatNumber,
  tableCellClass,
  tableHeadClass,
  tableRowClass,
  TableFrame,
} from './AdminUI';

interface AdminAcademicsProps {
  academics: AcademicAnalytics | null;
}

const subjectColors = ['#64ffda', '#a78bfa', '#fbbf24', '#60a5fa', '#f472b6'];

export const AdminAcademics: React.FC<AdminAcademicsProps> = ({ academics }) => {
  if (!academics) {
    return <EmptyData title="No academic telemetry recorded" detail="Subject enrollment and quiz performance will appear after students begin using those workflows." />;
  }

  const sortedSubjects = [...academics.topSubjects].sort((a, b) => b.count - a.count);
  const totalEnrollments = sortedSubjects.reduce((sum, subject) => sum + subject.count, 0);
  const topSubject = sortedSubjects[0];
  const averageEnrollment = sortedSubjects.length > 0 ? Math.round(totalEnrollments / sortedSubjects.length) : 0;
  const quizScore = Math.max(0, Math.min(100, academics.avgQuizScore));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Average quiz score"
          value={`${quizScore.toFixed(1)}%`}
          detail="Across completed attempts"
          icon={<Target className="h-[18px] w-[18px]" />}
          tone="mint"
        />
        <StatCard
          label="Quiz attempts"
          value={formatNumber(academics.totalQuizAttempts)}
          detail="Recorded completions"
          icon={<Award className="h-[18px] w-[18px]" />}
          tone="violet"
        />
        <StatCard
          label="Top subject"
          value={topSubject?.subject || '—'}
          detail={topSubject ? `${formatNumber(topSubject.count)} enrollments` : 'No subject data'}
          icon={<GraduationCap className="h-[18px] w-[18px]" />}
          tone="mint"
        />
        <StatCard
          label="Subjects tracked"
          value={formatNumber(sortedSubjects.length)}
          detail={`${formatNumber(totalEnrollments)} combined enrollments`}
          icon={<BookOpen className="h-[18px] w-[18px]" />}
          tone="violet"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <Panel
          title="Top enrolled study subjects"
          subtitle="Ranked by total enrollment"
          action={<StatusPill label={`${sortedSubjects.length} subjects`} tone="slate" />}
          className="xl:col-span-7"
        >
          <HorizontalBars
            data={sortedSubjects.slice(0, 8).map((subject, index) => ({
              label: subject.subject,
              value: subject.count,
              color: subjectColors[index % subjectColors.length] || '#64ffda',
              detail: formatNumber(subject.count),
            }))}
            ariaLabel="Study subjects ranked by total enrollment"
            emptyMessage="No subject enrollment data"
          />
        </Panel>

        <Panel title="Quiz performance" subtitle="Average score across all attempts" className="xl:col-span-5">
          <div className="flex min-h-[280px] flex-col items-center justify-center">
            <div className="relative h-52 w-52">
              <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90" role="img" aria-label={`Average quiz score is ${quizScore.toFixed(1)} percent`}>
                <circle cx="60" cy="60" r="50" fill="none" stroke="#25303d" strokeWidth="10" />
                <circle
                  cx="60"
                  cy="60"
                  r="50"
                  fill="none"
                  stroke="#64ffda"
                  strokeWidth="10"
                  strokeLinecap="round"
                  pathLength="100"
                  strokeDasharray={`${quizScore} ${100 - quizScore}`}
                />
              </svg>
              <div className="absolute inset-0 grid place-content-center text-center">
                <strong className="text-4xl font-semibold tracking-[-0.05em] text-white tabular-nums">{quizScore.toFixed(1)}%</strong>
                <span className="mt-1 text-xs text-slate-500">average score</span>
              </div>
            </div>
            <div className="mt-5 flex items-center gap-2 text-xs text-slate-400">
              <Award className="h-4 w-4 text-[#64ffda]" aria-hidden="true" />
              Based on {formatNumber(academics.totalQuizAttempts)} attempts
            </div>
          </div>
        </Panel>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <Panel title="Enrollment distribution" subtitle="Share of tracked subject enrollments" className="xl:col-span-4">
          {sortedSubjects.length > 0 ? (
            <DonutChart
              segments={sortedSubjects.slice(0, 5).map((subject, index) => ({
                label: subject.subject,
                value: subject.count,
                color: subjectColors[index % subjectColors.length] || '#64ffda',
                detail: totalEnrollments > 0 ? `${((subject.count / totalEnrollments) * 100).toFixed(1)}%` : '0%',
              }))}
              centerValue={formatNumber(totalEnrollments)}
              centerLabel="enrollments"
              ariaLabel="Distribution of enrollments across the top study subjects"
              className="sm:grid-cols-1 2xl:grid-cols-[140px_minmax(0,1fr)]"
            />
          ) : (
            <EmptyData title="No enrollment distribution" />
          )}
        </Panel>

        <Panel title="Subjects ranked by enrollment" subtitle="Exact counts and share" bodyClassName="p-0" className="xl:col-span-5">
          <TableFrame className="rounded-none border-0">
            <table className="w-full text-left">
              <thead className={tableHeadClass}>
                <tr>
                  <th className={`${tableCellClass} w-12`} scope="col">#</th>
                  <th className={tableCellClass} scope="col">Subject</th>
                  <th className={`${tableCellClass} text-right`} scope="col">Enrollments</th>
                  <th className={`${tableCellClass} text-right`} scope="col">Share</th>
                </tr>
              </thead>
              <tbody>
                {sortedSubjects.map((subject, index) => (
                  <tr key={subject.subject} className={tableRowClass}>
                    <td className={`${tableCellClass} text-slate-500 tabular-nums`}>{index + 1}</td>
                    <td className={`${tableCellClass} font-medium text-slate-200`}>{subject.subject}</td>
                    <td className={`${tableCellClass} text-right tabular-nums`}>{formatNumber(subject.count)}</td>
                    <td className={`${tableCellClass} text-right text-slate-400 tabular-nums`}>
                      {totalEnrollments > 0 ? `${((subject.count / totalEnrollments) * 100).toFixed(1)}%` : '0%'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableFrame>
        </Panel>

        <Panel title="Enrollment signals" subtitle="Plain-language summary" className="xl:col-span-3">
          <div className="space-y-4">
            <div className="rounded-lg border border-[#64ffda]/15 bg-[#64ffda]/[0.05] p-4">
              <TrendingUp className="h-5 w-5 text-[#64ffda]" aria-hidden="true" />
              <p className="mt-3 text-xs font-semibold text-slate-200">Strongest demand</p>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                {topSubject
                  ? `${topSubject.subject} leads with ${formatNumber(topSubject.count)} enrollments.`
                  : 'No subject is currently ranked.'}
              </p>
            </div>
            <div className="rounded-lg border border-[#a78bfa]/15 bg-[#a78bfa]/[0.05] p-4">
              <BarChart3 className="h-5 w-5 text-[#a78bfa]" aria-hidden="true" />
              <p className="mt-3 text-xs font-semibold text-slate-200">Typical subject</p>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                The tracked subjects average {formatNumber(averageEnrollment)} enrollments each.
              </p>
            </div>
          </div>
        </Panel>
      </div>
    </div>
  );
};
