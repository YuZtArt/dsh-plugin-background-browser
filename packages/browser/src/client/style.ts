export const styles = `
.dsh-browser{--bb-bg:#181818;--bb-surface:#222222;--bb-hover:#303030;--bb-border:#ffffff12;--bb-text:#e3e3e3;--bb-muted:#919191;--bb-accent:#a9c7b5;height:100%;min-height:0;min-width:0;display:flex;flex-direction:column;background:var(--bb-bg);color:var(--bb-text);font:12px/1.45 -apple-system,BlinkMacSystemFont,"Segoe UI","Microsoft YaHei",sans-serif;color-scheme:dark;position:relative;isolation:isolate;overflow:hidden}
.dsh-browser *{box-sizing:border-box}
.dsh-browser button,.dsh-browser input{font:inherit;color:inherit}
.dsh-browser button{border:0;background:none;cursor:pointer;padding:0;flex-shrink:0}
.dsh-browser button:disabled{opacity:.3;cursor:default}
.dsh-browser button:focus-visible,.dsh-browser input:focus-visible{outline:2px solid #829e91;outline-offset:-2px}
.dsh-browser svg{width:16px;height:16px;display:block;flex-shrink:0}
.bb-icon{width:28px;height:28px;display:inline-flex;align-items:center;justify-content:center;border-radius:6px;color:var(--bb-muted)!important}
.bb-icon:hover:not(:disabled),.bb-icon[aria-expanded=true]{background:var(--bb-hover);color:var(--bb-text)!important}
.bb-tabs{height:38px;padding:5px 8px 0;display:flex;gap:4px;align-items:center;flex-shrink:0}
.bb-tablist{min-width:0;display:flex;gap:3px;overflow:auto;scrollbar-width:none;align-self:stretch}
.bb-tablist::-webkit-scrollbar{display:none}
.bb-tab{display:flex;align-items:center;gap:2px;border-radius:8px 8px 0 0;min-width:88px;max-width:180px;color:var(--bb-muted);border:1px solid transparent;border-bottom:0}
.bb-tab.is-active{background:var(--bb-surface);color:var(--bb-text);border-color:var(--bb-border)}
.bb-tab-select{display:flex;align-items:center;gap:7px;min-width:0;flex-shrink:1!important;height:30px;padding:0 8px!important;flex:1;text-align:left}
.bb-tab-select span{overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
.bb-tab .bb-icon{width:22px;height:22px;margin-right:4px}
.bb-tab .bb-icon svg{width:12px;height:12px}
.bb-tabs-spacer{flex:1}
.bb-control{display:flex;align-items:center;gap:5px;padding:4px 8px!important;border-radius:6px;white-space:nowrap;color:var(--bb-muted)!important}
.bb-control:hover:not(:disabled){background:var(--bb-hover)}
.bb-control.is-manual{color:var(--bb-accent)!important;background:#a9c7b510}
.bb-control svg{width:13px;height:13px}
.bb-toolbar{height:43px;display:flex;align-items:center;gap:3px;padding:5px 8px 7px;border-bottom:1px solid var(--bb-border);flex-shrink:0}
.bb-address{display:flex;align-items:center;gap:6px;flex:1;min-width:0;height:29px;margin:0 4px;background:#ffffff08;border:1px solid transparent;border-radius:7px;padding:0 8px;color:var(--bb-muted)}
.bb-address:focus-within{border-color:#ffffff26;background:var(--bb-surface)}
.bb-address>svg{width:13px;height:13px}
.bb-address input{background:none;border:0;outline:0!important;min-width:0;width:100%;height:100%;font-size:11px;color:var(--bb-text)}
.bb-address input::placeholder{color:#777}
.bb-address button{width:20px;height:22px}
.bb-address button svg{width:13px;height:13px}
.bb-canvas{min-height:0;flex:1;overflow:auto;position:relative;background:var(--bb-bg);scrollbar-width:thin;scrollbar-color:#4a4a4a transparent}
.bb-canvas img{display:block;width:100%;max-width:none;outline-offset:-2px}
.bb-canvas.is-manual img{cursor:default}
.bb-canvas.is-original img{width:1280px}
.bb-empty{height:100%;min-height:210px;display:flex;align-items:center;justify-content:center;flex-direction:column;padding:32px;text-align:center;color:var(--bb-muted);gap:10px}
.bb-empty>svg{width:29px;height:29px;stroke-width:1.35;margin-bottom:4px;color:#888}
.bb-empty strong{font-size:14px;font-weight:500;color:#d5d5d5}
.bb-empty p{margin:0;font-size:12px;line-height:1.8;max-width:260px}
.bb-status{display:flex;justify-content:space-between;align-items:center;gap:10px;min-height:25px;padding:4px 11px;color:#808080;font-size:10px;flex-shrink:0;border-top:1px solid var(--bb-border)}
.bb-status-label{display:flex;gap:6px;align-items:center;min-width:0}
.bb-dot{width:5px;height:5px;border-radius:50%;background:#777;flex-shrink:0}
.bb-dot.is-live{background:#92b5a1}
.bb-status-hint{overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
.bb-error{display:flex;align-items:center;gap:8px;padding:8px 12px;color:#e5b1a7;background:#ae514810;font-size:11px;border-bottom:1px solid #ae514820;overflow-wrap:anywhere}
.bb-error span{flex:1;min-width:0}
.bb-menu{position:absolute;z-index:3;right:8px;top:76px;width:190px;padding:5px;background:#272727;border:1px solid #ffffff18;border-radius:9px;box-shadow:0 12px 32px #0006}
.bb-menu button{display:flex;align-items:center;gap:9px;width:100%;text-align:left;padding:8px!important;border-radius:5px;color:#ccc}
.bb-menu button:hover:not(:disabled){background:#ffffff09}
.bb-input-panel{position:absolute;z-index:4;right:8px;top:76px;width:min(330px,calc(100% - 16px));padding:12px;background:#272727;border:1px solid #ffffff18;border-radius:10px;box-shadow:0 12px 32px #0006}
.bb-input-heading{display:flex;align-items:center;justify-content:space-between;font-size:12px;font-weight:500;margin-bottom:3px}
.bb-input-panel p{margin:0 0 12px;color:#999;font-size:11px;line-height:1.6}
.bb-input-row{display:flex;gap:6px}
.bb-input-row input{flex:1;min-width:0;width:100%;border:1px solid #ffffff16;background:#191919;border-radius:6px;padding:7px 9px}
.bb-input-row button{padding:6px 10px!important;background:#dfdfdf;color:#202020;border-radius:6px;font-weight:500}
.bb-input-actions{display:flex;gap:4px;margin-top:8px;justify-content:flex-end}
.bb-input-actions button{padding:4px 8px!important;color:#aaa;border-radius:5px}
.bb-input-actions button:hover{background:#ffffff0a}
@container (max-width:360px){.bb-status-hint{display:none}}
`;
