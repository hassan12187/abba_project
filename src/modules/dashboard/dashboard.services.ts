import studentApplicationModel from "../student.application/studentApplicationModel.js"
import roomModel               from "../hostel/room.model.js"
import HostelBlockModel        from "../hostel/hostelBlock.model.js"
import FeeInvoiceModel         from "../feeInvoice/FeeInvoice.js"
import MessSubscriptionModel   from "../messSubscription/MessSubscription.model.js"
import { HttpError }           from "../../utils/errors.js"

export const DashboardService = {

  async getHomeDashboard() {
    // Run all aggregations in parallel — one round-trip to MongoDB
    const [
      studentStats,
      roomStats,
      invoiceStats,
      subscriptionStats,
      recentActivity,
    ] = await Promise.all([

      // ── Students ────────────────────────────────────────────────────────────
      studentApplicationModel.aggregate([
        {
          $group: {
            _id:     null,
            total:   { $sum: 1 },
            approved:{ $sum: { $cond: [{ $eq: ["$status", "approved"] }, 1, 0] } },
            accepted:{ $sum: { $cond: [{ $eq: ["$status", "accepted"] }, 1, 0] } },
            pending: { $sum: { $cond: [{ $eq: ["$status", "pending"]  }, 1, 0] } },
            rejected:{ $sum: { $cond: [{ $eq: ["$status", "rejected"] }, 1, 0] } },
            withRoom:{ $sum: { $cond: [{ $ifNull: ["$room_id", false] }, 1, 0] } },
            messEnabled: { $sum: { $cond: ["$messEnabled", 1, 0] } },
          },
        },
      ]),

      // ── Rooms ────────────────────────────────────────────────────────────────
      roomModel.aggregate([
        {
          $group: {
            _id:            null,
            totalRooms:     { $sum: 1 },
            totalCapacity:  { $sum: "$capacity" },
            totalOccupants: { $sum: { $size: { $ifNull: ["$occupants", []] } } },
            available: {
              $sum: { $cond: [{ $eq: ["$status", "available"] }, 1, 0] },
            },
            occupied: {
              $sum: { $cond: [{ $eq: ["$status", "occupied"] }, 1, 0] },
            },
            maintenance: {
              $sum: { $cond: [{ $eq: ["$status", "maintenance"] }, 1, 0] },
            },
          },
        },
      ]),

      // ── Fee Invoices (current calendar month) ────────────────────────────────
      FeeInvoiceModel.aggregate([
        {
          $group: {
            _id:             null,
            totalInvoices:   { $sum: 1 },
            totalRevenue:    { $sum: "$totalPaid" },
            totalOutstanding:{ $sum: "$balanceDue" },
            paid:            { $sum: { $cond: [{ $eq: ["$status", "Paid"]           }, 1, 0] } },
            partially:       { $sum: { $cond: [{ $eq: ["$status", "Partially Paid"] }, 1, 0] } },
            pending:         { $sum: { $cond: [{ $eq: ["$status", "Pending"]        }, 1, 0] } },
            overdue:         { $sum: { $cond: [{ $eq: ["$status", "Overdue"]        }, 1, 0] } },
          },
        },
      ]),

      // ── Mess subscriptions ───────────────────────────────────────────────────
      MessSubscriptionModel.aggregate([
        {
          $group: {
            _id:              null,
            total:            { $sum: 1 },
            active:           { $sum: { $cond: [{ $eq: ["$status", "Active"]    }, 1, 0] } },
            suspended:        { $sum: { $cond: [{ $eq: ["$status", "Suspended"] }, 1, 0] } },
            monthlyRevenue:   { $sum: { $cond: [{ $eq: ["$status", "Active"]    }, "$monthlyFee", 0] } },
          },
        },
      ]),

      // ── Recent activity (last 10 events across collections) ──────────────────
      // Pull latest applications and latest paid invoices, sort by date
      (async () => {
        const [apps, invoices] = await Promise.all([
          studentApplicationModel
            .find({}, { student_name: 1, status: 1, createdAt: 1 })
            .sort({ createdAt: -1 })
            .limit(5)
            .lean(),
          FeeInvoiceModel
            .find({ status: "Paid" }, { invoiceNumber: 1, totalPaid: 1, student_name: 1, createdAt: 1 })
            .sort({ createdAt: -1 })
            .limit(5)
            .lean(),
        ])

        const events = [
          ...apps.map((a) => ({
            type:    "application" as const,
            message: `${a.student_name} submitted a hostel application`,
            status:  a.status,
            date:    a.createdAt,
          })),
          ...invoices.map((i) => ({
            type:    "payment" as const,
            message: `Payment of ₹${(i.totalPaid as number).toLocaleString("en-IN")} received — ${i.student_name}`,
            status:  "Paid",
            date:    (i as any).createdAt,
          })),
        ]
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, 8)
        console.log(events);
        return events
      })(),
    ])

    // ── Derived values ────────────────────────────────────────────────────────
    const s  = studentStats[0]   ?? {}
    const r  = roomStats[0]      ?? {}
    const fi = invoiceStats[0]   ?? {}
    const ms = subscriptionStats[0] ?? {}

    const occupancyRate = r.totalCapacity > 0
      ? Math.round((r.totalOccupants / r.totalCapacity) * 100)
      : 0

    return {
      // ── Student stats
      totalStudents:       s.total     ?? 0,
      approvedStudents:    s.approved  ?? 0,
      acceptedStudents:    s.accepted  ?? 0,
      pendingApplications: s.pending   ?? 0,
      rejectedStudents:    s.rejected  ?? 0,
      studentsWithRoom:    s.withRoom  ?? 0,
      messEnabledStudents: s.messEnabled ?? 0,

      // ── Room stats
      totalRooms:          r.totalRooms     ?? 0,
      totalCapacity:       r.totalCapacity  ?? 0,
      occupiedRooms:       r.occupied       ?? 0,
      availableRooms:      r.available      ?? 0,
      maintenanceRooms:    r.maintenance    ?? 0,
      totalOccupants:      r.totalOccupants ?? 0,
      occupancyRate,

      // ── Payment stats
      totalInvoices:       fi.totalInvoices    ?? 0,
      paymentsDone:        fi.paid             ?? 0,
      partialPayments:     fi.partially        ?? 0,
      pendingInvoices:     fi.pending          ?? 0,
      overduePayments:     fi.overdue          ?? 0,
      totalRevenue:        Math.round((fi.totalRevenue    ?? 0) * 100) / 100,
      totalOutstanding:    Math.round((fi.totalOutstanding ?? 0) * 100) / 100,

      // ── Mess stats
      totalSubscriptions:  ms.total          ?? 0,
      activeSubscriptions: ms.active         ?? 0,
      suspendedSubs:       ms.suspended      ?? 0,
      messMonthlyRevenue:  Math.round((ms.monthlyRevenue ?? 0) * 100) / 100,

      // ── Recent activity feed
      recentActivity,
    }
  },
}