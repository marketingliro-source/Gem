import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import frLocale from '@fullcalendar/core/locales/fr';
import { Plus, User } from 'lucide-react';
import styles from './Calendar.module.css';
import AddAppointmentModal from '../components/AddAppointmentModal';

const Calendar = () => {
  const { user } = useAuth();
  const calendarRef = useRef(null);
  const [appointments, setAppointments] = useState([]);
  const [events, setEvents] = useState([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState('');
  const [agents, setAgents] = useState([]);

  useEffect(() => {
    fetchAppointments();
    if (user?.role === 'admin') {
      fetchAgents();
    }
  }, []);

  useEffect(() => {
    // Convert appointments to FullCalendar events
    const calendarEvents = appointments
      .filter(apt => !selectedAgent || apt.user_id === parseInt(selectedAgent))
      .map(apt => ({
        id: apt.id,
        title: `${apt.time} - ${apt.first_name} ${apt.last_name}`,
        start: `${apt.date}T${apt.time}`,
        extendedProps: {
          leadName: `${apt.first_name} ${apt.last_name}`,
          agent: apt.username,
          time: apt.time,
          leadId: apt.lead_id,
          clientId: apt.client_id
        },
        backgroundColor: getEventColor(apt.user_id),
        borderColor: getEventColor(apt.user_id)
      }));
    setEvents(calendarEvents);
  }, [appointments, selectedAgent]);

  const fetchAppointments = async () => {
    try {
      const response = await api.get('/appointments');
      setAppointments(response.data);
    } catch (error) {
      console.error('Erreur lors du chargement des RDV:', error);
    }
  };

  const fetchAgents = async () => {
    try {
      const response = await api.get('/users/agents');
      setAgents(response.data);
    } catch (error) {
      console.error('Erreur lors du chargement des agents:', error);
    }
  };

  const getEventColor = (userId) => {
    const colors = ['#10b981', '#3b82f6', '#f59e0b', '#ec4899', '#8b5cf6', '#06b6d4'];
    return colors[userId % colors.length];
  };

  const handleEventDrop = async (info) => {
    try {
      const newDate = info.event.start.toISOString().split('T')[0];
      const newTime = info.event.start.toTimeString().slice(0, 5);

      await api.patch(`/appointments/${info.event.id}`, {
        date: newDate,
        time: newTime
      });

      fetchAppointments();
    } catch (error) {
      console.error('Erreur lors du déplacement du RDV:', error);
      info.revert();
      alert('Erreur lors du déplacement du rendez-vous');
    }
  };

  const handleEventClick = (info) => {
    const event = info.event;
    const props = event.extendedProps;

    const message = `Rendez-vous:\n\nDate: ${event.start.toLocaleDateString('fr-FR')}\nHeure: ${props.time}\nContact: ${props.leadName}\nAgent: ${props.agent}`;

    if (confirm(`${message}\n\nVoulez-vous supprimer ce rendez-vous ?`)) {
      handleDeleteAppointment(event.id);
    }
  };

  const handleDeleteAppointment = async (id) => {
    try {
      await api.delete(`/appointments/${id}`);
      fetchAppointments();
    } catch (error) {
      console.error('Erreur lors de la suppression:', error);
      alert('Erreur lors de la suppression du rendez-vous');
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>Agenda</h1>
        <div className={styles.toolbar}>
          {user?.role === 'admin' && (
            <div className={styles.filterGroup}>
              <User size={18} />
              <select
                value={selectedAgent}
                onChange={(e) => setSelectedAgent(e.target.value)}
                className={styles.agentFilter}
              >
                <option value="">Tous les agents</option>
                {agents.map(agent => (
                  <option key={agent.id} value={agent.id}>{agent.username}</option>
                ))}
              </select>
            </div>
          )}
          <button onClick={() => setShowAddModal(true)} className={styles.addBtn}>
            <Plus size={20} /> Ajouter RDV
          </button>
        </div>
      </div>

      <div className={styles.calendarWrapper}>
        <FullCalendar
          ref={calendarRef}
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
          initialView="timeGridWeek"
          locale={frLocale}
          headerToolbar={{
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth,timeGridWeek,timeGridDay'
          }}
          buttonText={{
            today: "Aujourd'hui",
            month: 'Mois',
            week: 'Semaine',
            day: 'Jour'
          }}
          slotMinTime="08:00:00"
          slotMaxTime="20:00:00"
          allDaySlot={false}
          height="auto"
          events={events}
          editable={true}
          droppable={true}
          eventDrop={handleEventDrop}
          eventClick={handleEventClick}
          eventTimeFormat={{
            hour: '2-digit',
            minute: '2-digit',
            meridiem: false
          }}
          slotLabelFormat={{
            hour: '2-digit',
            minute: '2-digit',
            meridiem: false
          }}
          weekends={true}
          firstDay={1}
        />
      </div>

      {showAddModal && (
        <AddAppointmentModal
          onClose={() => setShowAddModal(false)}
          onSuccess={() => {
            fetchAppointments();
            setShowAddModal(false);
          }}
        />
      )}
    </div>
  );
};

export default Calendar;
