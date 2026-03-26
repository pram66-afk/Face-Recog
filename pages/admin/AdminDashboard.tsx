import React from 'react';
import { Users, BookOpen, AlertTriangle, Calendar, TrendingUp, BarChart3 } from 'lucide-react';
import { STUDENTS, SUBJECTS } from '../../data';

const AdminDashboard = () => {
  const lowAttendanceStudents = STUDENTS.filter(s => s.overallAttendance < 85);

  const stats = [
    { label: 'Total Students', value: '1,240', icon: Users, gradient: 'from-blue-500 to-indigo-500', shadow: 'shadow-blue-500/15' },
    { label: 'Total Faculty', value: '58', icon: Users, gradient: 'from-purple-500 to-pink-500', shadow: 'shadow-purple-500/15' },
    { label: 'Total Subjects', value: SUBJECTS.length.toString(), icon: BookOpen, gradient: 'from-emerald-500 to-teal-500', shadow: 'shadow-emerald-500/15' },
    { label: 'Active Classes', value: '8', icon: Calendar, gradient: 'from-amber-500 to-orange-500', shadow: 'shadow-amber-500/15' },
  ];

  const attendanceData = [
    { name: 'Mon', present: 85 },
    { name: 'Tue', present: 88 },
    { name: 'Wed', present: 92 },
    { name: 'Thu', present: 78 },
    { name: 'Fri', present: 82 },
    { name: 'Sat', present: 95 },
  ];
  const maxVal = Math.max(...attendanceData.map(d => d.present));

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Admin Dashboard</h2>
        <p className="text-sm text-slate-500 mt-0.5">Overview of your institution's attendance</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 stagger-children">
        {stats.map((stat, index) => (
          <div key={index} className="candy-card p-4 sm:p-5 flex items-center space-x-3">
            <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${stat.gradient} flex items-center justify-center shadow-md ${stat.shadow} flex-shrink-0`}>
              <stat.icon className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-[11px] text-slate-500 font-medium uppercase tracking-wider">{stat.label}</p>
              <h4 className="text-xl sm:text-2xl font-bold text-slate-900">{stat.value}</h4>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Low Attendance */}
        <div className="candy-card overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
              </div>
              <h3 className="text-sm font-bold text-slate-800">Low Attendance (&lt; 85%)</h3>
            </div>
            <span className="bg-red-100 text-red-700 text-[10px] px-2.5 py-1 rounded-full font-bold uppercase tracking-wider">
              {lowAttendanceStudents.length} alerts
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="text-[10px] text-slate-400 uppercase tracking-wider border-b border-slate-100">
                  <th className="px-4 py-2.5 font-semibold">USN</th>
                  <th className="px-4 py-2.5 font-semibold">Name</th>
                  <th className="px-4 py-2.5 font-semibold">%</th>
                  <th className="px-4 py-2.5 font-semibold">Action</th>
                </tr>
              </thead>
              <tbody className="text-sm divide-y divide-slate-50">
                {lowAttendanceStudents.map((student) => (
                  <tr key={student.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-4 py-3 font-semibold text-slate-900 text-xs">{student.usn}</td>
                    <td className="px-4 py-3 text-slate-600 text-xs">{student.name}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-lg text-[10px] font-bold bg-amber-100 text-amber-700">
                        {student.overallAttendance}%
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button className="text-indigo-600 hover:text-indigo-800 text-xs font-semibold transition-colors">
                        Notify
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Chart */}
        <div className="candy-card p-5">
          <div className="flex items-center space-x-2 mb-5">
            <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center">
              <BarChart3 className="w-4 h-4 text-indigo-600" />
            </div>
            <h3 className="text-sm font-bold text-slate-800">Weekly Trend</h3>
          </div>
          <div className="h-56 w-full flex items-end justify-between space-x-2 px-1">
            {attendanceData.map((d) => (
              <div key={d.name} className="flex flex-col items-center flex-1 h-full justify-end group">
                <div className="relative w-full max-w-[36px] bg-slate-100 rounded-xl h-full flex items-end overflow-hidden">
                  <div
                    style={{ height: `${d.present}%` }}
                    className={`w-full rounded-xl transition-all duration-700 bg-gradient-to-t ${d.present >= 85 ? 'from-indigo-500 to-blue-500' : 'from-amber-500 to-orange-500'
                      } group-hover:opacity-80 relative`}
                  >
                    <div className="absolute -top-7 left-1/2 transform -translate-x-1/2 bg-slate-800 text-white text-[10px] px-2 py-1 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap font-semibold">
                      {d.present}%
                    </div>
                  </div>
                </div>
                <span className="text-[10px] text-slate-500 mt-2 font-semibold">{d.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;