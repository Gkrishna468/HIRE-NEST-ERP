import React, { useState } from 'react';
import { X, Calendar, Percent, CheckCircle2 } from 'lucide-react';
import { Button } from '../../lib/Button';
import { PlacementOrchestrator } from '../../lib/workflows/PlacementOrchestrator';
import { formatINR } from '../../lib/currency';

export function OfferCreatorModal({ submission, requirement, onClose }: any) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [formData, setFormData] = useState({
    baseSalary: '',
    currency: 'INR',
    bonus: '',
    joiningDate: '',
    placementFeePercent: '20',
    notes: ''
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleCreateOffer = async () => {
    if (!formData.baseSalary || !formData.joiningDate) {
      alert("Please fill in base salary and joining date.");
      return;
    }

    setIsProcessing(true);
    try {
      await PlacementOrchestrator.initiateOffer({
        submissionId: submission.id,
        candidateId: submission.candidateId,
        candidateName: submission.candidateName || 'Anonymous',
        requirementId: requirement?.id || submission.requirementId,
        clientId: requirement?.clientId || submission.clientId,
        vendorId: submission.vendorId,
        dealRoomId: submission.dealRoomId,
        offerDetails: {
          baseSalary: Number(formData.baseSalary),
          currency: formData.currency,
          bonus: formData.bonus ? Number(formData.bonus) : 0,
          joiningDate: formData.joiningDate,
          placementFeePercent: Number(formData.placementFeePercent),
          notes: formData.notes
        },
        expectedFee: (Number(formData.baseSalary) * Number(formData.placementFeePercent)) / 100
      });
      alert("Offer Released successfully!");
      onClose();
    } catch (err) {
      console.error(err);
      alert("Failed to release offer.");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white rounded-3xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col my-8">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div>
            <h2 className="text-xl font-black flex items-center gap-2 text-slate-800"><CheckCircle2 size={20} className="text-emerald-600"/> Generate Offer</h2>
            <p className="text-slate-500 text-xs font-medium mt-1">for {submission.candidateName}</p>
          </div>
          <button onClick={onClose} className="p-2 bg-white hover:bg-slate-200 rounded-full transition-colors border border-slate-200">
            <X size={20} className="text-slate-600" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1 space-y-5">
           <div className="grid grid-cols-2 gap-4">
              <div>
                 <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Base Salary (INR)</label>
                 <div className="relative">
                    <span className="absolute left-3 top-3.5 text-xs font-black text-slate-400">₹</span>
                    <input type="number" name="baseSalary" value={formData.baseSalary} onChange={handleChange} className="w-full pl-9 pr-4 py-3 border border-slate-300 rounded-xl text-sm bg-slate-50 outline-none focus:ring-2 focus:ring-indigo-500" placeholder="e.g. 1800000" />
                 </div>
              </div>
              <div>
                 <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Currency</label>
                 <div className="w-full px-4 py-3 border border-slate-200 bg-slate-100 rounded-xl text-sm font-bold text-slate-700 flex items-center">
                    ₹ INR (Indian Rupee)
                 </div>
              </div>
           </div>

           <div className="grid grid-cols-2 gap-4">
              <div>
                 <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Sign-on Bonus (INR)</label>
                 <div className="relative">
                    <span className="absolute left-3 top-3.5 text-xs font-black text-slate-400">₹</span>
                    <input type="number" name="bonus" value={formData.bonus} onChange={handleChange} className="w-full pl-9 pr-4 py-3 border border-slate-300 rounded-xl text-sm bg-white outline-none focus:ring-2 focus:ring-indigo-500" placeholder="e.g. 100000" />
                 </div>
              </div>
              <div>
                 <label className="block text-xs font-bold text-slate-500 uppercase mb-1 flex items-center gap-1"><Calendar size={12}/> Target Joining Date</label>
                 <input type="date" name="joiningDate" value={formData.joiningDate} onChange={handleChange} className="w-full px-4 py-3 border border-slate-300 rounded-xl text-sm bg-white outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
           </div>

           <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1 flex items-center gap-1"><Percent size={12}/> Placement Fee Match</label>
              <input type="number" name="placementFeePercent" value={formData.placementFeePercent} onChange={handleChange} className="w-full px-4 py-3 border border-slate-300 rounded-xl text-sm bg-white outline-none focus:ring-2 focus:ring-indigo-500" placeholder="20" />
              <p className="text-[10px] text-slate-400 mt-1">Expected Revenue: {formData.baseSalary && formData.placementFeePercent ? formatINR((Number(formData.baseSalary) * Number(formData.placementFeePercent)) / 100) : formatINR(0)}</p>
           </div>

           <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1 flex items-center gap-1">Notes / Terms</label>
              <textarea name="notes" placeholder="Condition of employment, stock options, etc..." value={formData.notes} onChange={handleChange} className="w-full px-4 py-3 border border-slate-300 rounded-xl text-sm bg-white outline-none focus:ring-2 focus:ring-indigo-500 resize-none" rows={3}></textarea>
           </div>
        </div>

        <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-3 shrink-0">
          <Button onClick={onClose} disabled={isProcessing} variant="outline" className="text-slate-600 bg-white">Cancel</Button>
          <Button onClick={handleCreateOffer} disabled={isProcessing} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-6">
            {isProcessing ? 'Processing...' : 'Release Offer'}
          </Button>
        </div>
      </div>
    </div>
  );
}
