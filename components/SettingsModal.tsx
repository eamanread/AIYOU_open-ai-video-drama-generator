
import React, { useState, useEffect } from 'react';
import { X, Save, Key, ExternalLink, Image as ImageIcon, Video, Type, Music } from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// 模型配置
const MODEL_CATEGORIES = {
  image: {
    label: '图片生成模型',
    icon: ImageIcon,
    models: [
      { value: 'imagen-4.0-fast-generate', label: 'Imagen 4.0 Fast (快速)' },
      { value: 'imagen-4.0-generate', label: 'Imagen 4.0 (标准)' },
      { value: 'imagen-4.0-ultra-generate', label: 'Imagen 4.0 Ultra (超高质量)' },
      { value: 'gemini-3-pro-image', label: 'Gemini 3 Pro Image' },
      { value: 'gemini-2.5-flash-preview-image', label: 'Gemini 2.5 Flash Preview' },
      { value: 'gemini-2.5-flash-image', label: 'Gemini 2.5 Flash (默认)' }
    ]
  },
  video: {
    label: '视频生成模型',
    icon: Video,
    models: [
      { value: 'veo-3.0-fast-generate', label: 'Veo 3.0 Fast (快速)' },
      { value: 'veo-3.1-fast-generate-preview', label: 'Veo 3.1 Fast (极速)' },
      { value: 'veo-3.1-generate-preview', label: 'Veo 3.1 (专业)' },
      { value: 'wan-2.1-t2v-14b', label: 'Wan 2.1 (动画风格)' }
    ]
  },
  text: {
    label: '文本生成模型',
    icon: Type,
    models: [
      { value: 'gemini-3-pro', label: 'Gemini 3 Pro (最强推理)' },
      { value: 'gemini-3-pro-preview', label: 'Gemini 3 Pro Preview' },
      { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash (默认)' },
      { value: 'gemini-3-flash', label: 'Gemini 3 Flash (快速)' }
    ]
  },
  audio: {
    label: '音频生成模型',
    icon: Music,
    models: [
      { value: 'gemini-2.5-flash-preview-tts', label: 'Gemini 2.5 Flash TTS (默认)' },
      { value: 'gemini-2.5-flash-native-audio-dialog', label: 'Gemini 2.5 Native Audio (对话)' }
    ]
  }
};

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const [polloKey, setPolloKey] = useState('');
  const [isSaved, setIsSaved] = useState(false);

  // 模型配置状态
  const [selectedModels, setSelectedModels] = useState({
    image: 'gemini-2.5-flash-image',
    video: 'veo-3.1-fast-generate-preview',
    text: 'gemini-2.5-flash',
    audio: 'gemini-2.5-flash-preview-tts'
  });

  useEffect(() => {
    const stored = localStorage.getItem('pollo_api_key');
    if (stored) setPolloKey(stored);

    // 加载模型配置
    const imageModel = localStorage.getItem('default_image_model');
    const videoModel = localStorage.getItem('default_video_model');
    const textModel = localStorage.getItem('default_text_model');
    const audioModel = localStorage.getItem('default_audio_model');

    setSelectedModels({
      image: imageModel || 'gemini-2.5-flash-image',
      video: videoModel || 'veo-3.1-fast-generate-preview',
      text: textModel || 'gemini-2.5-flash',
      audio: audioModel || 'gemini-2.5-flash-preview-tts'
    });
  }, [isOpen]);

  const handleSave = () => {
    localStorage.setItem('pollo_api_key', polloKey.trim());

    // 保存模型配置
    localStorage.setItem('default_image_model', selectedModels.image);
    localStorage.setItem('default_video_model', selectedModels.video);
    localStorage.setItem('default_text_model', selectedModels.text);
    localStorage.setItem('default_audio_model', selectedModels.audio);

    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
    setTimeout(onClose, 500);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center animate-in fade-in duration-200" onClick={onClose}>
      <div
        className="w-[600px] max-h-[85vh] bg-[#1c1c1e] border border-white/10 rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-4 border-b border-white/5 flex justify-between items-center bg-white/5">
          <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors">
            <X size={18} />
          </button>
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-slate-700/50 rounded-lg">
                <Key size={16} className="text-white" />
            </div>
            <span className="text-sm font-bold text-white">设置 (Settings)</span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6">
          {/* API Key 配置 */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Pollo.ai API Key (Wan 2.5)</label>
                <a href="https://pollo.ai/dashboard/api-keys" target="_blank" rel="noreferrer" className="flex items-center gap-1 text-[10px] text-cyan-400 hover:text-cyan-300 transition-colors">
                    <span>获取 Key</span>
                    <ExternalLink size={10} />
                </a>
            </div>

            <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <span className="text-slate-500 font-mono text-xs">key-</span>
                </div>
                <input
                    type="password"
                    autoComplete="off"
                    className="w-full bg-black/30 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500/50 transition-colors font-mono"
                    placeholder="粘贴您的 Pollo API Key..."
                    value={polloKey}
                    onChange={(e) => setPolloKey(e.target.value)}
                />
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed">
                用于激活 <strong>Wan 2.1 / Wan 2.5</strong> 视频生成模型。密钥仅保存在您的浏览器本地存储中，不会上传至 SunStudio 服务器。
            </p>
          </div>

          {/* 模型配置 */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-white/10">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">默认模型配置</span>
            </div>

            {Object.entries(MODEL_CATEGORIES).map(([key, category]) => {
              const Icon = category.icon;
              return (
                <div key={key} className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Icon size={14} className="text-slate-500" />
                    <label className="text-xs font-medium text-slate-300">{category.label}</label>
                  </div>
                  <select
                    value={selectedModels[key as keyof typeof selectedModels]}
                    onChange={(e) => setSelectedModels({ ...selectedModels, [key]: e.target.value })}
                    className="w-full bg-black/30 border border-white/10 rounded-lg py-2 px-3 text-sm text-white focus:outline-none focus:border-cyan-500/50 transition-colors appearance-none cursor-pointer hover:bg-black/40"
                  >
                    {category.models.map((model) => (
                      <option key={model.value} value={model.value} className="bg-[#1c1c1e]">
                        {model.label}
                      </option>
                    ))}
                  </select>
                </div>
              );
            })}

            <p className="text-[11px] text-slate-500 leading-relaxed mt-4">
              💡 这些设置将作为新节点的默认模型。现有节点需要在节点面板中手动切换模型。
            </p>
          </div>
        </div>

        <div className="p-4 border-t border-white/5 bg-[#121214] flex justify-end">
            <button
                onClick={handleSave}
                className={`px-6 py-2 rounded-xl text-xs font-bold transition-all ${isSaved ? 'bg-green-500 text-white' : 'bg-white text-black hover:bg-cyan-400'}`}
            >
                {isSaved ? '✓ 已保存' : '保存设置'}
            </button>
        </div>
      </div>
    </div>
  );
};
