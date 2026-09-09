import { showNotification } from '../services/utils/notifications';
import React, { useState, useEffect, useRef } from 'react';
import { 
  format, 
  startOfMonth, 
  endOfMonth, 
  startOfWeek, 
  endOfWeek, 
  eachDayOfInterval, 
  isSameMonth, 
  isSameDay, 
  addMonths, 
  subMonths, 
  addWeeks, 
  subWeeks,
  addDays,
  subDays,
  startOfDay,
  isToday,
  parseISO,
  getHours,
  getMinutes,
  differenceInMinutes,
  setHours,
  setMinutes,
  addYears
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  ChevronLeft, 
  ChevronRight, 
  Calendar as CalendarIcon, 
  Plus, 
  Clock, 
  MapPin, 
  AlignLeft, 
  X,
  Trash2,
  Save,
  MoreHorizontal,
  Copy,
  Printer,
  Repeat,
  Info
} from 'lucide-react';
import { db } from '../services/db';
import { CalendarEvent } from '../types';

const CalendarPage: React.FC = () => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<'day' | 'week' | 'month'>('month');
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [showCalendars, setShowCalendars] = useState({
    calendar: true,
    birthdays: true,
    holidays: true
  });
  const [draggedEvent, setDraggedEvent] = useState<CalendarEvent | null>(null);
  const [holidays, setHolidays] = useState<CalendarEvent[]>([]);
  const [viewMoreDate, setViewMoreDate] = useState<Date | null>(null);
  const [showInfoModal, setShowInfoModal] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);

  // Form State
  const [eventTitle, setEventTitle] = useState('');
  const [eventStart, setEventStart] = useState('');
  const [eventEnd, setEventEnd] = useState('');
  const [eventAllDay, setEventAllDay] = useState(false);
  const [eventLocation, setEventLocation] = useState('');
  const [eventDescription, setEventDescription] = useState('');
  const [eventColor, setEventColor] = useState('blue');
  const [recurrenceType, setRecurrenceType] = useState<'none' | 'daily' | 'weekly' | 'monthly' | 'yearly'>('none');
  const [recurrenceEndDate, setRecurrenceEndDate] = useState('');
  const [applyToSeries, setApplyToSeries] = useState(false);
  const [confirmDeleteSeries, setConfirmDeleteSeries] = useState(false);

  useEffect(() => {
    loadEvents();
    fetchHolidays();
    // Scroll to current time on mount if in day/week view
    if (view !== 'month' && scrollRef.current) {
      const now = new Date();
      const minutes = now.getHours() * 60 + now.getMinutes();
      scrollRef.current.scrollTop = Math.max(0, minutes - 200); // Scroll slightly before current time
    }
  }, [view]);

  const loadEvents = async () => {
    const loadedEvents = await db.getEvents();
    setEvents(loadedEvents);
  };

  const fetchHolidays = async () => {
    try {
      const year = currentDate.getFullYear();
      const response = await fetch(`https://brasilapi.com.br/api/feriados/v1/${year}`);
      if (!response.ok) throw new Error('Failed to fetch holidays');
      
      const data = await response.json();
      const holidayEvents: CalendarEvent[] = data.map((h: any) => ({
        id: `holiday-${h.date}`,
        title: h.name,
        start: `${h.date}T00:00`,
        end: `${h.date}T23:59`,
        allDay: true,
        color: 'gray', // Distinct color for holidays
        description: 'Feriado Nacional',
        location: 'Brasil'
      }));
      setHolidays(holidayEvents);
    } catch (error) {
      console.error('Error fetching holidays:', error);
    }
  };

  const next = () => {
    if (view === 'month') setCurrentDate(addMonths(currentDate, 1));
    else if (view === 'week') setCurrentDate(addWeeks(currentDate, 1));
    else setCurrentDate(addDays(currentDate, 1));
  };

  const prev = () => {
    if (view === 'month') setCurrentDate(subMonths(currentDate, 1));
    else if (view === 'week') setCurrentDate(subWeeks(currentDate, 1));
    else setCurrentDate(subDays(currentDate, 1));
  };

  const today = () => setCurrentDate(new Date());

  const handleDateClick = (date: Date, hour?: number) => {
    setSelectedDate(date);
    let start = date;
    if (hour !== undefined) {
      start = setHours(start, hour);
      start = setMinutes(start, 0);
    }
    setEventStart(format(start, "yyyy-MM-dd'T'HH:mm"));
    setEventEnd(format(addDays(start, 0), "yyyy-MM-dd'T'HH:mm")); // Default same day
    
    // Default duration 1 hour
    const end = new Date(start.getTime() + 60 * 60 * 1000);
    setEventEnd(format(end, "yyyy-MM-dd'T'HH:mm"));

    setEditingEvent(null);
    setEventTitle('');
    setEventAllDay(false);
    setEventLocation('');
    setEventDescription('');
    setEventColor('blue');
    setRecurrenceType('none');
    setRecurrenceEndDate('');
    setConfirmDeleteSeries(false);
    setIsModalOpen(true);
  };

  const handleEventClick = (e: React.MouseEvent, event: CalendarEvent) => {
    e.stopPropagation();
    setEditingEvent(event);
    setEventTitle(event.title);
    setEventStart(event.start);
    setEventEnd(event.end);
    setEventAllDay(event.allDay);
    setEventLocation(event.location || '');
    setEventDescription(event.description || '');
    setEventColor(event.color || 'blue');
    setRecurrenceType('none'); // Editing existing event defaults to no recurrence change
    setRecurrenceEndDate('');
    setApplyToSeries(false); // Reset series application
    setConfirmDeleteSeries(false);
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    const titleToSave = eventTitle.trim() || '(Sem título)';

    const baseEvent: CalendarEvent = {
      id: editingEvent ? editingEvent.id : (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Date.now().toString()),
      title: titleToSave,
      start: eventStart,
      end: eventEnd,
      allDay: eventAllDay,
      location: eventLocation,
      description: eventDescription,
      color: eventColor,
      groupId: editingEvent?.groupId // Preserve groupId by default
    };

    if (editingEvent) {
      if (editingEvent.groupId && applyToSeries) {
          // Update all events in the series (only metadata)
          await db.updateEventsByGroupId(editingEvent.groupId, {
              title: titleToSave,
              description: eventDescription,
              location: eventLocation,
              color: eventColor,
              allDay: eventAllDay
          });
      } else {
          // Update only this event
          // If it was part of a group but we're editing only this one, remove it from the group
          if (editingEvent.groupId && !applyToSeries) {
              baseEvent.groupId = undefined;
          }
          await db.updateEvent(baseEvent);
      }
    } else {
      if (recurrenceType === 'none') {
        await db.addEvent(baseEvent);
      } else {
        // Generating recurring events
        const groupId = (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Date.now().toString());
        const eventsToCreate: CalendarEvent[] = [];
        
        // Add groupId to the base event
        baseEvent.groupId = groupId;
        eventsToCreate.push(baseEvent);

        let currentStart = parseISO(eventStart);
        let currentEnd = parseISO(eventEnd);
        // Default limit: 1 year from start if not specified
        const limitDate = recurrenceEndDate ? parseISO(recurrenceEndDate) : addYears(currentStart, 1); 

        // Safety limit to prevent infinite loops
        let count = 0;
        const maxEvents = 365; 

        while (count < maxEvents) {
            count++;
            let nextStart, nextEnd;

            if (recurrenceType === 'daily') {
                nextStart = addDays(currentStart, 1);
                nextEnd = addDays(currentEnd, 1);
            } else if (recurrenceType === 'weekly') {
                nextStart = addWeeks(currentStart, 1);
                nextEnd = addWeeks(currentEnd, 1);
            } else if (recurrenceType === 'monthly') {
                nextStart = addMonths(currentStart, 1);
                nextEnd = addMonths(currentEnd, 1);
            } else if (recurrenceType === 'yearly') {
                nextStart = addYears(currentStart, 1);
                nextEnd = addYears(currentEnd, 1);
            } else {
                break;
            }

            if (nextStart > limitDate) break;

            eventsToCreate.push({
                ...baseEvent,
                id: (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Date.now().toString()) + '-' + count,
                start: format(nextStart, "yyyy-MM-dd'T'HH:mm"),
                end: format(nextEnd, "yyyy-MM-dd'T'HH:mm"),
                groupId: groupId // Assign same groupId
            });

            currentStart = nextStart;
            currentEnd = nextEnd;
        }
        
        if (db.addEvents) {
            await db.addEvents(eventsToCreate);
        } else {
            for (const evt of eventsToCreate) {
                await db.addEvent(evt);
            }
        }
      }
    }

    setIsModalOpen(false);
    loadEvents();
  };

  const handleDelete = async () => {
    if (editingEvent) {
      await db.deleteEvent(editingEvent.id);
      setIsModalOpen(false);
      loadEvents();
    }
  };

  const handleDeleteSeries = async () => {
      console.log('handleDeleteSeries called');
      if (!confirmDeleteSeries) {
          setConfirmDeleteSeries(true);
          setTimeout(() => setConfirmDeleteSeries(false), 3000); // Reset after 3 seconds
          return;
      }

      if (editingEvent && editingEvent.groupId) {
          console.log('Deleting series with groupId:', editingEvent.groupId);
          try {
              console.log('Calling db.deleteEventsByGroupId...');
              await db.deleteEventsByGroupId(editingEvent.groupId);
              console.log('db.deleteEventsByGroupId finished.');
              
              setIsModalOpen(false);
              setConfirmDeleteSeries(false);
              await loadEvents();
              console.log('Events reloaded.');
          } catch (error) {
              console.error('Error deleting series:', error);
              showNotification('Erro ao excluir série: ' + error, 'error');
          }
      } else {
          console.error('No groupId found for series deletion');
          showNotification('Erro: Identificador da série não encontrado.', 'error');
      }
  };

  const handleDuplicate = async () => {
    if (editingEvent) {
      const newEvent: CalendarEvent = {
        ...editingEvent,
        id: (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Date.now().toString()),
        title: `${editingEvent.title} (Cópia)`,
      };
      await db.addEvent(newEvent);
      setIsModalOpen(false);
      loadEvents();
    }
  };

  // Drag and Drop Handlers
  const handleDragStart = (e: React.DragEvent, event: CalendarEvent) => {
    setDraggedEvent(event);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', event.id);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDropOnDay = async (e: React.DragEvent, targetDay: Date) => {
    e.preventDefault();
    if (!draggedEvent) return;

    const originalStart = parseISO(draggedEvent.start);
    const originalEnd = parseISO(draggedEvent.end);
    const duration = originalEnd.getTime() - originalStart.getTime();
    
    const newStart = new Date(targetDay);
    newStart.setHours(getHours(originalStart), getMinutes(originalStart));
    
    const newEnd = new Date(newStart.getTime() + duration);

    const updatedEvent = {
      ...draggedEvent,
      start: format(newStart, "yyyy-MM-dd'T'HH:mm"),
      end: format(newEnd, "yyyy-MM-dd'T'HH:mm"),
    };

    await db.updateEvent(updatedEvent);
    setDraggedEvent(null);
    loadEvents();
  };

  const handleDropOnTime = async (e: React.DragEvent, targetDay: Date, targetHour: number) => {
    e.preventDefault();
    if (!draggedEvent) return;

    const originalStart = parseISO(draggedEvent.start);
    const originalEnd = parseISO(draggedEvent.end);
    const duration = originalEnd.getTime() - originalStart.getTime();

    const newStart = new Date(targetDay);
    newStart.setHours(targetHour, 0, 0, 0);
    
    const newEnd = new Date(newStart.getTime() + duration);

    const updatedEvent = {
      ...draggedEvent,
      start: format(newStart, "yyyy-MM-dd'T'HH:mm"),
      end: format(newEnd, "yyyy-MM-dd'T'HH:mm"),
    };

    await db.updateEvent(updatedEvent);
    setDraggedEvent(null);
    loadEvents();
  };

  // Filter events based on selected calendars
  const filteredEvents = [
    ...events.filter(event => {
      if (event.color === 'green' && !showCalendars.birthdays) return false;
      if (event.color !== 'green' && !showCalendars.calendar) return false;
      return true;
    }),
    ...(showCalendars.holidays ? holidays : [])
  ];

  // Helper to check if an event spans multiple days
  const isMultiDayEvent = (event: CalendarEvent) => {
    const start = parseISO(event.start);
    const end = parseISO(event.end);
    return !isSameDay(start, end);
  };

  // Helper to check if an event occurs on a specific day (handling multi-day)
  const isEventOnDay = (event: CalendarEvent, day: Date) => {
    const start = startOfDay(parseISO(event.start));
    const end = startOfDay(parseISO(event.end));
    const current = startOfDay(day);
    return current >= start && current <= end;
  };

  // --- Render Helpers ---

  const getEventStyle = (event: CalendarEvent) => {
    const start = parseISO(event.start);
    const end = parseISO(event.end);
    const startMinutes = getHours(start) * 60 + getMinutes(start);
    const durationMinutes = differenceInMinutes(end, start);
    
    return {
      top: `${startMinutes}px`,
      height: `${Math.max(durationMinutes, 30)}px`, // Min height 30px
    };
  };

  const renderTimeGrid = (daysToShow: Date[]) => {
    const hours = Array.from({ length: 24 }, (_, i) => i);

    return (
      <div className="flex flex-1 overflow-hidden bg-white dark:bg-gray-800">
        {/* Main Grid Container */}
        <div className="flex-1 overflow-auto relative" ref={scrollRef}>
           {/* Header Row - Sticky */}
           <div className="sticky top-0 z-30 flex border-b border-gray-200 dark:border-gray-700 h-14 bg-gray-50 dark:bg-gray-800 shadow-sm min-w-fit">
             <div className="w-16 flex-shrink-0 border-r border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 sticky left-0 z-40"></div> {/* Spacer for time col */}
             <div className="flex flex-1">
               {daysToShow.map((day, i) => (
                 <div key={i} className={`flex-1 flex flex-col items-center justify-center py-1 border-l border-gray-200 dark:border-gray-700 ${isToday(day) ? 'text-primary-600' : 'text-gray-500 dark:text-gray-400'} bg-gray-50 dark:bg-gray-800 min-w-[100px]`}>
                   <span className="text-xl font-bold leading-none">{format(day, 'd')}</span>
                   <span className="text-xs uppercase font-medium mt-0.5">{format(day, 'EEE', { locale: ptBR }).replace('.', '')}</span>
                 </div>
               ))}
             </div>
           </div>

           {/* Scrollable Grid */}
           <div className="flex min-h-[1440px] relative min-w-fit">
             {/* Time Labels (Sticky to stay on left) */}
             <div className="sticky left-0 top-0 bottom-0 w-16 border-r border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 z-20">
               {hours.map(h => (
                 <div key={h} className="h-[60px] text-xs text-gray-400 text-right pr-2 pt-1 relative">
                   <span className="-top-2 relative">{h}:00</span>
                 </div>
               ))}
             </div>

             {/* Grid Columns */}
             <div className="flex flex-1">
               {daysToShow.map((day, i) => {
                 const dayEvents = events.filter(e => isSameDay(parseISO(e.start), day) && !e.allDay);
                 const allDayEvents = events.filter(e => isSameDay(parseISO(e.start), day) && e.allDay);

                 return (
                   <div key={i} className="flex-1 border-l border-gray-200 dark:border-gray-700 relative min-w-[100px] group">
                     {/* Hour Lines */}
                     {hours.map(h => (
                       <div 
                          key={h} 
                          className="h-[60px] border-b border-gray-100 dark:border-gray-700/50 box-border"
                          onClick={() => handleDateClick(day, h)}
                          onDragOver={handleDragOver}
                          onDrop={(e) => handleDropOnTime(e, day, h)}
                       ></div>
                     ))}

                     {/* Current Time Indicator */}
                     {isToday(day) && (
                       <div 
                         className="absolute w-full border-t-2 border-red-500 z-20 pointer-events-none flex items-center"
                         style={{ top: `${new Date().getHours() * 60 + new Date().getMinutes()}px` }}
                       >
                         <div className="w-2 h-2 bg-red-500 rounded-full -ml-1"></div>
                       </div>
                     )}

                     {/* Events */}
                     {dayEvents.map(event => (
                       <div
                         key={event.id}
                         draggable
                         onDragStart={(e) => handleDragStart(e, event)}
                         onClick={(e) => handleEventClick(e, event)}
                         className={`absolute left-1 right-1 rounded p-1 text-xs border-l-4 overflow-hidden cursor-move shadow-sm hover:z-30 transition-all hover:brightness-95 ${
                           event.color === 'red' ? 'bg-red-100 border-red-500 text-red-700 dark:bg-red-900/50 dark:text-red-100' :
                           event.color === 'green' ? 'bg-green-100 border-green-500 text-green-700 dark:bg-green-900/50 dark:text-green-100' :
                           event.color === 'purple' ? 'bg-purple-100 border-purple-500 text-purple-700 dark:bg-purple-900/50 dark:text-purple-100' :
                           event.color === 'orange' ? 'bg-orange-100 border-orange-500 text-orange-700 dark:bg-orange-900/50 dark:text-orange-100' :
                           'bg-blue-100 border-blue-500 text-blue-700 dark:bg-blue-900/50 dark:text-blue-100'
                         }`}
                         style={getEventStyle(event)}
                       >
                         <div className="font-bold truncate">{event.title}</div>
                         <div className="truncate opacity-80">{event.location}</div>
                       </div>
                     ))}
                   </div>
                 );
               })}
             </div>
           </div>
        </div>
      </div>
    );
  };

  // Month View Variables
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart);
  const endDate = endOfWeek(monthEnd);
  const calendarDays = eachDayOfInterval({ start: startDate, end: endDate });

  return (
    <div className="flex flex-col h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 overflow-hidden print:overflow-visible print:h-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between p-4 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shadow-sm z-10 gap-4 flex-shrink-0">
        <div className="flex items-center gap-4 flex-wrap">
          <button 
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors shadow-sm font-medium print:hidden"
          >
            <Plus size={20} />
            <span className="hidden sm:inline">Novo evento</span>
          </button>
          
          <div className="flex items-center bg-gray-100 dark:bg-gray-700 rounded-lg p-1 print:hidden">
            <button onClick={prev} className="p-1 hover:bg-white dark:hover:bg-gray-600 rounded-md transition-colors">
              <ChevronLeft size={20} />
            </button>
            <button onClick={next} className="p-1 hover:bg-white dark:hover:bg-gray-600 rounded-md transition-colors">
              <ChevronRight size={20} />
            </button>
          </div>

          <h2 className="text-lg md:text-xl font-bold capitalize truncate">
            {view === 'day' 
              ? format(currentDate, "d 'de' MMMM, yyyy", { locale: ptBR })
              : format(currentDate, 'MMMM yyyy', { locale: ptBR })
            }
          </h2>

          <button 
            onClick={() => window.print()}
            className="p-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors print:hidden ml-2"
            title="Imprimir Calendário"
          >
            <Printer size={20} />
          </button>
          <button 
            onClick={() => setShowInfoModal(true)}
            className="p-2 text-gray-400 hover:text-primary-500 bg-white dark:bg-gray-800 rounded-full shadow-sm border border-gray-100 dark:border-gray-700 transition-colors print:hidden ml-2"
            title="Como funciona a Agenda?"
          >
            <Info size={20} />
          </button>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0 w-full md:w-auto no-scrollbar print:hidden">
           <button onClick={today} className="px-3 py-1.5 text-sm font-medium border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors whitespace-nowrap">
             Hoje
           </button>
           <div className="flex bg-gray-100 dark:bg-gray-700 rounded-lg p-1 flex-shrink-0">
             <button 
               onClick={() => setView('day')}
               className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors whitespace-nowrap ${view === 'day' ? 'bg-white dark:bg-gray-600 shadow-sm' : 'text-gray-500 dark:text-gray-400'}`}
             >
               Dia
             </button>
             <button 
               onClick={() => setView('week')}
               className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors whitespace-nowrap ${view === 'week' ? 'bg-white dark:bg-gray-600 shadow-sm' : 'text-gray-500 dark:text-gray-400'}`}
             >
               Semana
             </button>
             <button 
               onClick={() => setView('month')}
               className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors whitespace-nowrap ${view === 'month' ? 'bg-white dark:bg-gray-600 shadow-sm' : 'text-gray-500 dark:text-gray-400'}`}
             >
               Mês
             </button>
           </div>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden print:overflow-visible print:h-auto">
        {/* Sidebar (Mini Calendar) - Hidden on mobile/tablet */}
        <div className="hidden xl:flex flex-col w-64 border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 gap-6 print:hidden">
           <div>
             <div className="flex items-center justify-between mb-4">
               <span className="font-bold text-sm">{format(currentDate, 'MMMM yyyy', { locale: ptBR })}</span>
               <div className="flex gap-1">
                 <button onClick={() => setCurrentDate(subMonths(currentDate, 1))} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"><ChevronLeft size={16}/></button>
                 <button onClick={() => setCurrentDate(addMonths(currentDate, 1))} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"><ChevronRight size={16}/></button>
               </div>
             </div>
             {/* Mini Calendar Grid */}
             <div className="grid grid-cols-7 gap-1 text-center text-xs">
               {['D','S','T','Q','Q','S','S'].map((d, i) => (
                 <div key={i} className="font-medium text-gray-500 py-1">{d}</div>
               ))}
               {eachDayOfInterval({ 
                  start: startOfWeek(startOfMonth(currentDate)), 
                  end: endOfWeek(endOfMonth(currentDate)) 
               }).map((day, i) => (
                 <div 
                   key={i} 
                   className={`py-1 rounded-full cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 ${
                     !isSameMonth(day, currentDate) ? 'text-gray-300 dark:text-gray-600' : ''
                   } ${
                     isSameDay(day, currentDate) ? 'bg-primary-600 text-white hover:bg-primary-700' : ''
                   }`}
                   onClick={() => setCurrentDate(day)}
                 >
                   {format(day, 'd')}
                 </div>
               ))}
             </div>
           </div>

           <div>
             <h3 className="font-bold text-sm mb-3 flex items-center justify-between">
               Meus calendários <ChevronLeft size={16} className="-rotate-90"/>
             </h3>
             <div className="space-y-2">
               <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
                 <input 
                   type="checkbox" 
                   checked={showCalendars.calendar} 
                   onChange={e => setShowCalendars({...showCalendars, calendar: e.target.checked})}
                   className="rounded text-primary-600 focus:ring-primary-500"
                 />
                 <span className="w-3 h-3 rounded-full bg-blue-500"></span>
                 Calendário
               </label>
               <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
                 <input 
                   type="checkbox" 
                   checked={showCalendars.birthdays} 
                   onChange={e => setShowCalendars({...showCalendars, birthdays: e.target.checked})}
                   className="rounded text-primary-600 focus:ring-primary-500"
                 />
                 <span className="w-3 h-3 rounded-full bg-green-500"></span>
                 Aniversários
               </label>
               <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
                 <input 
                   type="checkbox" 
                   checked={showCalendars.holidays} 
                   onChange={e => setShowCalendars({...showCalendars, holidays: e.target.checked})}
                   className="rounded text-primary-600 focus:ring-primary-500"
                 />
                 <span className="w-3 h-3 rounded-full bg-gray-500"></span>
                 Feriados
               </label>
             </div>
           </div>
        </div>

        {/* Main Content Area */}
        {view === 'month' ? (
          <div className="flex-1 overflow-y-auto bg-white dark:bg-gray-800 print:overflow-visible print:h-auto">
            <div className="grid grid-cols-7 border-b border-gray-200 dark:border-gray-700 sticky top-0 bg-white dark:bg-gray-800 z-10">
              {['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'].map(day => (
                <div key={day} className="py-2 text-center text-sm font-semibold text-gray-500 dark:text-gray-400 border-r border-gray-200 dark:border-gray-700 last:border-r-0">
                  <span className="hidden md:inline">{day}</span>
                  <span className="md:hidden">{day.slice(0, 3)}</span>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 auto-rows-fr min-h-[calc(100vh-140px)] print:min-h-0 print:h-auto print:auto-rows-auto">
              {calendarDays.map((day, i) => {
                const dayEvents = filteredEvents.filter(e => isEventOnDay(e, day));
                const maxEvents = 3; 
                const hasMore = dayEvents.length > maxEvents;
                const displayEvents = dayEvents.slice(0, maxEvents);

                return (
                  <div 
                    key={i}
                    onClick={() => handleDateClick(day)}
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDropOnDay(e, day)}
                    className={`min-h-[100px] border-b border-r border-gray-200 dark:border-gray-700 p-1 md:p-2 transition-colors hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer flex flex-col gap-1 ${
                      !isSameMonth(day, monthStart) ? 'bg-gray-50/50 dark:bg-gray-900/50 text-gray-400' : ''
                    }`}
                  >
                    <div className={`text-sm font-medium mb-1 ${isToday(day) ? 'bg-primary-600 text-white w-6 h-6 md:w-7 md:h-7 rounded-full flex items-center justify-center' : ''}`}>
                      {format(day, 'd')}
                    </div>
                    
                    {displayEvents.map(event => {
                      const isMultiDay = isMultiDayEvent(event);
                      const isStartDay = isSameDay(parseISO(event.start), day);
                      const isEndDay = isSameDay(parseISO(event.end), day);
                      
                      return (
                        <div 
                          key={event.id}
                          draggable
                          onDragStart={(e) => handleDragStart(e, event)}
                          onClick={(e) => handleEventClick(e, event)}
                          className={`text-[10px] md:text-xs p-1 rounded border-l-2 md:border-l-4 truncate shadow-sm hover:opacity-80 transition-opacity cursor-move ${
                            event.color === 'red' ? 'bg-red-100 border-red-500 text-red-700 dark:bg-red-900/30 dark:text-red-300' :
                            event.color === 'green' ? 'bg-green-100 border-green-500 text-green-700 dark:bg-green-900/30 dark:text-green-300' :
                            event.color === 'purple' ? 'bg-purple-100 border-purple-500 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' :
                            event.color === 'orange' ? 'bg-orange-100 border-orange-500 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300' :
                            event.color === 'gray' ? 'bg-gray-100 border-gray-500 text-gray-700 dark:bg-gray-700 dark:text-gray-300' :
                            'bg-blue-100 border-blue-500 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                          } ${isMultiDay ? 'rounded-none mx-[-1px]' : ''} ${
                            isMultiDay && isStartDay ? 'rounded-l ml-0' : ''
                          } ${
                            isMultiDay && isEndDay ? 'rounded-r mr-0' : ''
                          }`}
                        >
                          <span className="hidden md:inline mr-1">
                            {event.allDay || !isStartDay ? '' : format(parseISO(event.start), 'HH:mm')}
                          </span>
                          {isMultiDay && !isStartDay ? (
                            <span className="opacity-50 text-[9px] mr-1">cont.</span>
                          ) : null}
                          {event.title}
                        </div>
                      );
                    })}
                    {hasMore && (
                      <div 
                        className="text-[10px] text-gray-500 dark:text-gray-400 pl-1 hover:underline cursor-pointer"
                        onClick={(e) => {
                          e.stopPropagation();
                          setViewMoreDate(day);
                        }}
                      >
                        +{dayEvents.length - maxEvents} mais
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ) : view === 'week' ? (
          renderTimeGrid(eachDayOfInterval({ start: startOfWeek(currentDate), end: endOfWeek(currentDate) }))
        ) : (
          renderTimeGrid([currentDate])
        )}
      </div>

      {/* View More Events Modal */}
      {viewMoreDate && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in duration-200 flex flex-col max-h-[80vh]">
            <div className="flex justify-between items-center p-4 border-b dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
              <div className="flex flex-col">
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                  {format(viewMoreDate, 'EEEE', { locale: ptBR })}
                </span>
                <h3 className="font-bold text-lg">
                  {format(viewMoreDate, "d 'de' MMMM", { locale: ptBR })}
                </h3>
              </div>
              <button 
                onClick={() => setViewMoreDate(null)} 
                className="p-2 text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="p-4 overflow-y-auto flex-1 space-y-2">
              {filteredEvents
                .filter(e => isEventOnDay(e, viewMoreDate))
                .map(event => {
                  const isMultiDay = isMultiDayEvent(event);
                  const isStartDay = isSameDay(parseISO(event.start), viewMoreDate);
                  
                  return (
                    <div 
                      key={event.id}
                      onClick={() => {
                        setViewMoreDate(null);
                        handleEventClick({ stopPropagation: () => {} } as React.MouseEvent, event);
                      }}
                      className={`text-sm p-2 rounded border-l-4 cursor-pointer shadow-sm hover:opacity-80 transition-opacity ${
                        event.color === 'red' ? 'bg-red-100 border-red-500 text-red-700 dark:bg-red-900/30 dark:text-red-300' :
                        event.color === 'green' ? 'bg-green-100 border-green-500 text-green-700 dark:bg-green-900/30 dark:text-green-300' :
                        event.color === 'purple' ? 'bg-purple-100 border-purple-500 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' :
                        event.color === 'orange' ? 'bg-orange-100 border-orange-500 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300' :
                        event.color === 'gray' ? 'bg-gray-100 border-gray-500 text-gray-700 dark:bg-gray-700 dark:text-gray-300' :
                        'bg-blue-100 border-blue-500 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                      }`}
                    >
                      <div className="flex justify-between items-center mb-1">
                        <span className="font-bold truncate">{event.title}</span>
                        <span className="text-xs opacity-75 whitespace-nowrap">
                          {event.allDay ? 'Dia todo' : format(parseISO(event.start), 'HH:mm')}
                        </span>
                      </div>
                      {event.location && (
                        <div className="text-xs opacity-75 flex items-center gap-1 truncate">
                          <MapPin size={10} /> {event.location}
                        </div>
                      )}
                    </div>
                  );
                })}
                
                {filteredEvents.filter(e => isEventOnDay(e, viewMoreDate)).length === 0 && (
                  <div className="text-center text-gray-500 py-8">
                    Nenhum evento para este dia.
                  </div>
                )}
            </div>
            
            <div className="p-3 border-t dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50 flex justify-center">
               <button 
                 onClick={() => {
                   setViewMoreDate(null);
                   handleDateClick(viewMoreDate);
                 }}
                 className="text-primary-600 text-sm font-medium hover:underline flex items-center gap-1"
               >
                 <Plus size={14} /> Adicionar novo evento
               </button>
            </div>
          </div>
        </div>
      )}

      {/* Event Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="flex justify-between items-center p-4 border-b dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
              <h3 className="font-bold text-lg">{editingEvent ? 'Editar Evento' : 'Novo Evento'}</h3>
              <div className="flex items-center gap-2">
                {editingEvent && (
                  <>
                    <button onClick={handleDuplicate} className="p-2 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors" title="Duplicar">
                      <Copy size={20} />
                    </button>
                    {editingEvent.groupId && (
                        <button 
                            type="button" 
                            onClick={handleDeleteSeries} 
                            className={`p-2 rounded-lg transition-colors flex items-center gap-1 ${
                                confirmDeleteSeries 
                                    ? 'bg-red-600 text-white hover:bg-red-700' 
                                    : 'text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20'
                            }`}
                            title="Excluir Série Inteira"
                        >
                            <div className="relative">
                                <Trash2 size={20} />
                                {!confirmDeleteSeries && (
                                    <span className="absolute -top-1 -right-1 text-[8px] font-bold bg-red-600 text-white px-1 rounded-full">ALL</span>
                                )}
                            </div>
                            {confirmDeleteSeries && <span className="text-xs font-bold px-1">Confirmar?</span>}
                        </button>
                    )}
                    <button onClick={handleDelete} className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors" title={editingEvent.groupId ? "Excluir Apenas Este" : "Excluir"}>
                      <Trash2 size={20} />
                    </button>
                  </>
                )}
                <button onClick={() => setIsModalOpen(false)} className="p-2 text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors">
                  <X size={20} />
                </button>
              </div>
            </div>
            
            <div className="p-6 space-y-4">
              <input 
                type="text" 
                placeholder="Adicionar um título" 
                className="w-full text-2xl font-bold border-b-2 border-gray-200 dark:border-gray-700 focus:border-primary-500 bg-transparent outline-none py-2 placeholder-gray-400"
                value={eventTitle}
                onChange={e => setEventTitle(e.target.value)}
                autoFocus
              />

              <div className="flex items-center gap-4">
                <div className="p-2 bg-gray-100 dark:bg-gray-700 rounded-full text-gray-500">
                  <Clock size={20} />
                </div>
                <div className="flex-1 space-y-2">
                   <div className="flex flex-col sm:flex-row gap-2">
                     <input 
                       type="datetime-local" 
                       className="w-full sm:flex-1 p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 text-sm"
                       value={eventStart}
                       onChange={e => setEventStart(e.target.value)}
                     />
                     {!eventAllDay && (
                       <span className="hidden sm:block self-center text-gray-400">-</span>
                     )}
                     {!eventAllDay && (
                       <input 
                         type="datetime-local" 
                         className="w-full sm:flex-1 p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 text-sm"
                         value={eventEnd}
                         onChange={e => setEventEnd(e.target.value)}
                       />
                     )}
                   </div>
                   <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 cursor-pointer">
                     <input 
                       type="checkbox" 
                       checked={eventAllDay} 
                       onChange={e => setEventAllDay(e.target.checked)}
                       className="rounded text-primary-600 focus:ring-primary-500"
                     />
                     Dia inteiro
                   </label>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="p-2 bg-gray-100 dark:bg-gray-700 rounded-full text-gray-500">
                  <Repeat size={20} />
                </div>
                <div className="flex-1 flex flex-col gap-2">
                    <select
                      value={recurrenceType}
                      onChange={(e) => setRecurrenceType(e.target.value as any)}
                      className="w-full p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 outline-none focus:ring-2 focus:ring-primary-500"
                      disabled={!!editingEvent} // Disable for editing existing events to keep it simple
                    >
                      <option value="none">Não repetir</option>
                      <option value="daily">Diariamente</option>
                      <option value="weekly">Semanalmente</option>
                      <option value="monthly">Mensalmente</option>
                      <option value="yearly">Anualmente</option>
                    </select>
                    
                    {recurrenceType !== 'none' && (
                        <div className="flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
                            <span className="text-sm text-gray-500 whitespace-nowrap">Repetir até:</span>
                            <input 
                                type="date" 
                                value={recurrenceEndDate}
                                onChange={(e) => setRecurrenceEndDate(e.target.value)}
                                className="w-full p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 text-sm outline-none focus:ring-2 focus:ring-primary-500"
                            />
                        </div>
                    )}
                    
                    {editingEvent && editingEvent.groupId && (
                        <label className="flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400 cursor-pointer mt-2 p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-100 dark:border-blue-800">
                            <input 
                                type="checkbox" 
                                checked={applyToSeries} 
                                onChange={e => setApplyToSeries(e.target.checked)}
                                className="rounded text-blue-600 focus:ring-blue-500"
                            />
                            <span className="font-medium">Aplicar alterações a toda a série</span>
                        </label>
                    )}
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="p-2 bg-gray-100 dark:bg-gray-700 rounded-full text-gray-500">
                  <MapPin size={20} />
                </div>
                <input 
                  type="text" 
                  placeholder="Adicionar local" 
                  className="flex-1 p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 focus:ring-2 focus:ring-primary-500 outline-none"
                  value={eventLocation}
                  onChange={e => setEventLocation(e.target.value)}
                />
              </div>

              <div className="flex items-start gap-4">
                <div className="p-2 bg-gray-100 dark:bg-gray-700 rounded-full text-gray-500 mt-1">
                  <AlignLeft size={20} />
                </div>
                <textarea 
                  placeholder="Adicionar descrição" 
                  className="flex-1 p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 focus:ring-2 focus:ring-primary-500 outline-none min-h-[100px]"
                  value={eventDescription}
                  onChange={e => setEventDescription(e.target.value)}
                />
              </div>

              <div className="flex gap-2 pt-2">
                {['blue', 'green', 'red', 'purple', 'orange'].map(c => (
                  <button
                    key={c}
                    onClick={() => setEventColor(c)}
                    className={`w-8 h-8 rounded-full border-2 transition-all ${
                      eventColor === c ? 'border-gray-900 dark:border-white scale-110' : 'border-transparent'
                    } ${
                      c === 'blue' ? 'bg-blue-500' :
                      c === 'green' ? 'bg-green-500' :
                      c === 'red' ? 'bg-red-500' :
                      c === 'purple' ? 'bg-purple-500' :
                      'bg-orange-500'
                    }`}
                  />
                ))}
              </div>
            </div>

            <div className="p-4 bg-gray-50 dark:bg-gray-700/50 flex justify-end gap-3 border-t dark:border-gray-700">
              <button 
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors font-medium"
              >
                Cancelar
              </button>
              <button 
                onClick={handleSave}
                className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-bold shadow-lg shadow-primary-500/30 flex items-center gap-2"
              >
                <Save size={18} />
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Info Modal */}
      {showInfoModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-[60]">
          <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-md shadow-xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
                <Info className="text-primary-500" /> Como funciona a Agenda?
              </h2>
              <button 
                onClick={() => setShowInfoModal(false)}
                className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6 space-y-4 text-sm text-gray-600 dark:text-gray-300">
              <p>
                A <strong>Agenda Família</strong> é o lugar central para organizar os compromissos, eventos e lembretes de todos os membros da casa.
              </p>
              
              <div className="space-y-3 mt-4">
                <div className="flex items-start gap-3">
                  <div className="bg-blue-100 dark:bg-blue-900/30 p-1.5 rounded text-blue-600 dark:text-blue-400 mt-0.5">
                    <Plus size={16} />
                  </div>
                  <div>
                    <strong className="text-gray-800 dark:text-gray-200 block">Criar Eventos:</strong>
                    <p className="mt-1 opacity-90">
                      Clique no botão "Novo evento" ou clique diretamente em qualquer dia no calendário para adicionar um compromisso. Você pode definir horários, localização, descrição e até cores diferentes para organizar visualmente.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 mt-4">
                  <div className="bg-purple-100 dark:bg-purple-900/30 p-1.5 rounded text-purple-600 dark:text-purple-400 mt-0.5">
                    <Repeat size={16} />
                  </div>
                  <div>
                    <strong className="text-gray-800 dark:text-gray-200 block">Eventos Recorrentes:</strong>
                    <p className="mt-1 opacity-90">
                      Tem um compromisso que se repete? Ao criar um evento, você pode configurá-lo para se repetir diariamente, semanalmente, mensalmente ou anualmente. Ideal para aulas, pagamentos, aniversários, etc.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 mt-4">
                  <div className="bg-emerald-100 dark:bg-emerald-900/30 p-1.5 rounded text-emerald-600 dark:text-emerald-400 mt-0.5">
                    <CalendarIcon size={16} />
                  </div>
                  <div>
                    <strong className="text-gray-800 dark:text-gray-200 block">Visualizações e Filtros:</strong>
                    <p className="mt-1 opacity-90">
                      Alterne entre as visões de Dia, Semana ou Mês. Use o menu lateral (Filtros) para ocultar ou mostrar feriados, aniversários ou os eventos da família. Você também pode arrastar e soltar eventos para mudar a data facilmente!
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 dark:bg-gray-900/50 p-4 rounded-lg mt-4 border border-gray-100 dark:border-gray-700">
                <p className="text-xs text-center font-medium text-gray-500 dark:text-gray-400">
                  Dica: Você pode imprimir o calendário do mês clicando no ícone de impressora no topo da página!
                </p>
              </div>
            </div>
            
            <div className="p-4 bg-gray-50 dark:bg-gray-900 border-t border-gray-100 dark:border-gray-700 flex justify-end">
              <button 
                onClick={() => setShowInfoModal(false)}
                className="px-6 py-2 bg-primary-600 text-white font-medium rounded-lg hover:bg-primary-700 transition-colors"
              >
                Entendi
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CalendarPage;
