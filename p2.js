/* ================================================================
   Huy Rooms P2 — cac quy tac nghiep vu dung chung, tach dan khoi app.js.
   File khong phu thuoc DOM de co the kiem thu rieng va tai su dung.
   ================================================================ */
(function (root, factory) {
  var api = factory();
  root.HuyRoomsP2 = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var PIPELINE = ['new', 'contacted', 'appointment_confirmed', 'viewed', 'reserved', 'converted', 'lost'];
  var PIPELINE_LABELS = {
    new: 'Yêu cầu mới',
    contacted: 'Đã liên hệ',
    appointment_confirmed: 'Đã hẹn',
    viewed: 'Đã xem',
    reserved: 'Giữ chỗ',
    converted: 'Ký hợp đồng',
    lost: 'Không phù hợp'
  };
  var CLOSED = { converted: true, lost: true, cancelled: true };

  function normalizedText(value) {
    return String(value || '').trim().toLocaleLowerCase('vi');
  }

  function isOpenAppointment(item) {
    return !!item && !CLOSED[item.status];
  }

  function appointmentClash(list, candidate, exceptId) {
    return (list || []).find(function (item) {
      return item && item.id !== exceptId && isOpenAppointment(item) &&
        item.roomId === candidate.roomId && item.date === candidate.date && item.time === candidate.time;
    }) || null;
  }

  function filterAppointments(list, filters) {
    filters = filters || {};
    var q = normalizedText(filters.q);
    return (list || []).filter(function (item) {
      if (!item) return false;
      if (filters.status === 'open' && !isOpenAppointment(item)) return false;
      if (filters.status && filters.status !== 'all' && filters.status !== 'open' && item.status !== filters.status) return false;
      if (filters.from && String(item.date || '') < filters.from) return false;
      if (filters.to && String(item.date || '') > filters.to) return false;
      if (filters.roomId && item.roomId !== filters.roomId) return false;
      if (q) {
        var haystack = normalizedText([
          item.customerName, item.customerPhone, item.note, item.date, item.time,
          filters.roomName ? filters.roomName(item.roomId) : ''
        ].join(' '));
        if (haystack.indexOf(q) < 0) return false;
      }
      return true;
    });
  }

  function occupancyRate(rooms) {
    rooms = rooms || [];
    if (!rooms.length) return 0;
    var occupied = rooms.filter(function (room) { return room && room.status === 'occupied'; }).length;
    return Math.round(occupied * 100 / rooms.length);
  }

  function mapUrl(address) {
    var value = String(address || '').trim();
    return value ? 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(value) : '';
  }

  return {
    PIPELINE: PIPELINE,
    PIPELINE_LABELS: PIPELINE_LABELS,
    isOpenAppointment: isOpenAppointment,
    appointmentClash: appointmentClash,
    filterAppointments: filterAppointments,
    occupancyRate: occupancyRate,
    mapUrl: mapUrl
  };
});
