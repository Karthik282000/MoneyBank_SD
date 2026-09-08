import React from 'react';
import './PageLoader.css';

export default function PageLoader({ visible = true }) {
  if (!visible) return null;

  return (
    <div className="sd-page-loader" role="status" aria-live="polite" aria-busy="true">
      <div className="sd-page-loader__grid" />
      <div className="sd-page-loader__orb sd-page-loader__orb--one" />
      <div className="sd-page-loader__orb sd-page-loader__orb--two" />

      <div className="sd-page-loader__card">
        <div className="sd-page-loader__idol-wrap" aria-hidden="true">
          <span className="sd-page-loader__ring sd-page-loader__ring--outer" />
          <span className="sd-page-loader__ring sd-page-loader__ring--mid" />
          <span className="sd-page-loader__ring sd-page-loader__ring--inner" />
          <div className="sd-page-loader__idol">
            <img
              src={`${process.env.PUBLIC_URL || ''}/durga-idol-loader.png`}
              alt=""
            />
          </div>
        </div>

        <p className="sd-page-loader__eyebrow">Lake Gardens</p>
        <h2 className="sd-page-loader__title">
          Welcome to Sarbojanin Durgotsab Committee LakeGardens collection app
        </h2>
        <div className="sd-page-loader__bar">
          <span className="sd-page-loader__bar-fill" />
        </div>
        <p className="sd-page-loader__hint">Preparing your workspace</p>
      </div>
    </div>
  );
}
