import OffCanvas from '@renderer/components/OffCanvas'

export default function WelcomePage({
  onStart,
  showStartButton = true,
  embedded = false
}: {
  onStart: () => void
  showStartButton?: boolean
  embedded?: boolean
}): JSX.Element {
  const content = (
    <div className="welcome-page">
        {/* 图标 */}
        <div className="welcome-icon">
          <svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect width="64" height="64" rx="14" fill="#0A1428"/>
            <path d="M32 10L10 20v10c0 14.7 8.96 28.4 22 32 13.04-3.6 22-17.3 22-32V20L32 10z" fill="#C8AA6E" stroke="#F0E6D2" strokeWidth="2"/>
            <text x="32" y="42" textAnchor="middle" fill="#0A1428" fontSize="26" fontWeight="bold" fontFamily="Beaufort">L</text>
          </svg>
        </div>

        <h3 className="welcome-title">欢迎使用 League Skins Tool</h3>
        <p className="welcome-subtitle">一款本地化的英雄联盟皮肤管理工具</p>

        {/* 功能说明 */}
        <div className="welcome-section">
          <h4 className="welcome-section-title">主要功能</h4>
          <ul className="welcome-list">
            <li>
              <span className="welcome-bullet">🎮</span>
              <span>浏览并使用所有英雄的皮肤，包括未上架的稀有皮肤</span>
            </li>
            <li>
              <span className="welcome-bullet">🖼️</span>
              <span>支持皮肤炫彩（Chroma）选择，自由搭配颜色方案</span>
            </li>
            <li>
              <span className="welcome-bullet">📁</span>
              <span>支持导入本地皮肤资源包，灵活管理皮肤文件</span>
            </li>
            <li>
              <span className="welcome-bullet">🔄</span>
              <span>一键刷新皮肤列表，随时同步最新数据</span>
            </li>
            <li>
              <span className="welcome-bullet">⚡</span>
              <span>即选即用，无需重启客户端，快速切换皮肤</span>
            </li>
          </ul>
        </div>

        {/* 使用步骤 */}
        <div className="welcome-section">
          <h4 className="welcome-section-title">使用步骤</h4>
          <ol className="welcome-steps">
            <li>
              <strong>设置游戏路径</strong>
              <p>首次使用需选择英雄联盟安装目录下的 League of Legends.exe</p>
              <code>示例：D:\Games\League of Legends.exe</code>
            </li>
            <li>
              <strong>导入皮肤资源</strong>
              <p>通过「设置 → 使用本地 skins」导入已下载的皮肤资源包</p>
            </li>
            <li>
              <strong>选择英雄与皮肤</strong>
              <p>在英雄列表中选择英雄，浏览并点击应用你喜欢的皮肤</p>
            </li>
            <li>
              <strong>进入游戏体验</strong>
              <p>皮肤会在游戏中自动生效，享受全新的视觉体验</p>
            </li>
          </ol>
        </div>

        {/* 注意事项 */}
        <div className="welcome-section welcome-notice">
          <h4 className="welcome-section-title">注意事项</h4>
          <ul className="welcome-list">
            <li>
              <span className="welcome-bullet">⚠️</span>
              <span>本工具仅在游戏客户端运行时生效，请在进入游戏前选择皮肤</span>
            </li>
            <li>
              <span className="welcome-bullet">⚠️</span>
              <span>皮肤资源需自行准备，请确保资源文件与当前游戏版本兼容</span>
            </li>
            <li>
              <span className="welcome-bullet">⚠️</span>
              <span>请从可信渠道获取皮肤资源，避免下载恶意文件</span>
            </li>
          </ul>
        </div>

        {showStartButton && (
          <button className="welcome-start-btn" onClick={onStart}>
            开始使用
          </button>
        )}
    </div>
  )

  if (embedded) return content

  return (
    <OffCanvas active={true} setActive={() => null} compact displayExitButton={false}>
      {content}
    </OffCanvas>
  )
}
