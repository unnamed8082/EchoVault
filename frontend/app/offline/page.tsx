export default function OfflinePage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="text-6xl mb-4">📡</div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">网络已断开</h1>
        <p className="text-gray-600">请检查网络连接后重试</p>
      </div>
    </div>
  );
}
