"use client";

import React, { useState } from 'react';
import { Calendar, dateFnsLocalizer } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay } from 'date-fns';
import { ja } from 'date-fns/locale';
import 'react-big-calendar/lib/css/react-big-calendar.css';

const locales = {
  'ja': ja,
};

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales,
});

interface RequestData {
  id: string;
  type: string;
  facilityName: string | null;
  startDate: string | Date | null;
  endDate: string | Date | null;
  applicantEmail: string;
  status: string;
  purpose: string | null;
}

interface CalendarComponentProps {
  requests: RequestData[];
  userEmail: string;
  isAdminOrApprover: boolean; // 総務、部長、事務長などの管理者・承認者ロールか
}

export default function CalendarComponent({ requests, userEmail, isAdminOrApprover }: CalendarComponentProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [currentView, setCurrentView] = useState<'month' | 'week' | 'agenda'>('month');

  // カレンダーに表示可能なイベントオブジェクトへ変換
  const events = requests
    .filter(req => req.type === 'FACILITY' && req.startDate && req.endDate && req.status !== 'REJECTED')
    .map(req => {
      // 日付のパース
      let startStr = typeof req.startDate === 'string' ? req.startDate : new Date(req.startDate!).toISOString().split('T')[0];
      let endStr = typeof req.endDate === 'string' ? req.endDate : new Date(req.endDate!).toISOString().split('T')[0];
      
      const start = new Date(startStr + "T00:00:00");
      const end = new Date(endStr + "T00:00:00");
      // react-big-calendarの仕様で終日イベントの終了日はその日を含まないため1日加算
      end.setDate(end.getDate() + 1);

      // 他のユーザーの申請は、名前をマスクしてプライバシーを守る
      const isOwn = req.applicantEmail === userEmail;
      const displayStatus = req.status === 'APPROVED' || req.status === 'REPORTED' ? '承認済' : '確認中';
      const title = (isAdminOrApprover || isOwn)
        ? `${req.facilityName} (${req.applicantEmail.split('@')[0]}) - ${displayStatus}`
        : `${req.facilityName} - ${displayStatus}`;

      return {
        id: req.id,
        title: title,
        start: start,
        end: end,
        allDay: true,
        resource: req
      };
    });

  // ステータスに応じた背景色の設定
  const eventPropGetter = (event: any) => {
    let backgroundColor = '#3b82f6'; // default blue
    const status = event.resource.status;
    if (status === 'APPROVED' || status === 'REPORTED') {
      backgroundColor = '#10b981'; // green
    } else if (status === 'PENDING') {
      backgroundColor = '#f59e0b'; // amber
    }
    
    return {
      style: {
        backgroundColor,
        borderRadius: '4px',
        color: 'white',
        border: 'none',
        display: 'block'
      }
    };
  };

  const messages = {
    allDay: '終日',
    previous: '＜ 前へ',
    next: '次へ ＞',
    today: '今日',
    month: '月',
    week: '週',
    day: '日',
    agenda: 'リスト',
    date: '日付',
    time: '時間',
    event: '予定',
    noEventsInRange: 'この期間に予定はありません。',
    showMore: (total: number) => `他 ${total} 件`
  };

  return (
    <div style={{ height: '65vh', background: 'white', padding: '1rem', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}>
      <Calendar
        localizer={localizer}
        events={events}
        startAccessor="start"
        endAccessor="end"
        culture="ja"
        style={{ height: '100%' }}
        eventPropGetter={eventPropGetter}
        views={['month', 'week', 'agenda']}
        messages={messages}
        date={currentDate}
        onNavigate={(newDate) => setCurrentDate(newDate)}
        view={currentView}
        onView={(newView: any) => setCurrentView(newView)}
      />
    </div>
  );
}
