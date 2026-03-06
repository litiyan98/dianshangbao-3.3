import React from 'react';
import { motion } from 'framer-motion';
import { Sparkles } from 'lucide-react';
import GloveIcon from './GloveIcon';

interface CreditDisplayProps {
  credits: number | null;
  loading?: boolean;
  onClick: () => void;
}

const CreditDisplay: React.FC<CreditDisplayProps> = ({ credits, loading = false, onClick }) => {
  const hasCredits = (credits ?? 0) > 0;

  return (
    <motion.div
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      className="cursor-pointer"
      transition={{ type: 'spring', stiffness: 360, damping: 24 }}
    >
      <button
        type="button"
        onClick={onClick}
        className="px-3 py-2 md:px-4 md:py-2.5 bg-white/85 backdrop-blur-md border border-orange-200 text-stone-800 rounded-full font-black text-[10px] md:text-[12px] tracking-wide flex items-center gap-2 hover:border-orange-400 hover:shadow-md transition-all"
        title="查看算力资产中心"
      >
        <GloveIcon size={18} />
        {hasCredits && !loading ? (
          <motion.span
            animate={{ opacity: [0.5, 1, 0.5], scale: [0.9, 1.1, 0.9] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="text-amber-500"
          >
            <Sparkles size={14} />
          </motion.span>
        ) : (
          <span className="text-amber-400/50">
            <Sparkles size={14} />
          </span>
        )}
        <span>{loading ? '资产加载中...' : `生图剩余 ${credits ?? '--'} 张`}</span>
      </button>
    </motion.div>
  );
};

export default CreditDisplay;
