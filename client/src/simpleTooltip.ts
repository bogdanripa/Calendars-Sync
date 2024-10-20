// simpleTooltip.js
class SimpleTooltip {
    targetSelector: string;
    target: HTMLElement | null;
    message: string;
    tooltip: HTMLDivElement;
    localStorageKey: string;
    offsetY: number;

    constructor(targetSelector:string, message:string, offsetY=0) {
      this.targetSelector = targetSelector;
      this.target = document.querySelector(targetSelector);
      this.message = message;
      this.offsetY = offsetY;
      this.tooltip = document.createElement('div');
      this.localStorageKey = `tooltipShown_${this.targetSelector.replace(/[^a-zA-Z0-9]/g, '')}`;
  
      this.init();
    }
  
    init() {
      if (!localStorage.getItem(this.localStorageKey) && this.target) {
        this.setupTooltip();
      }
    }
  
    setupTooltip() {
      if (!this.target) return;
      Array.from(document.getElementsByClassName('simple-tooltip')).forEach((el) => el.remove());
      this.tooltip.className = 'simple-tooltip';
      this.tooltip.textContent = this.message;
      this.tooltip.style.cssText = `
        position: absolute;
        background-color: #EEE;
        border: 1px solid #DDD;
        border-radius: 5px;
        padding: 10px;
        display: none;
        z-index: 100;
        box-shadow: 0 2px 5px rgba(0,0,0,0.2);
        width: 200px;
        left: ${this.target.offsetLeft + this.target.offsetWidth / 2}px;
        transform: translateX(-50%);
        top: ${this.target.offsetTop - 20 + this.offsetY}px;  // adjust gap
      `;
  
      document.body.appendChild(this.tooltip);
      this.show();
      this.bindEvents();
  
      // Add arrow with border
      const arrow = document.createElement('div');
      arrow.style.cssText = `
        position: absolute;
        bottom: -10px;
        left: 50%;
        margin-left: -10px;
        width: 0;
        height: 0;
        border-style: solid;
        border-width: 10px 10px 0 10px;
        border-color: #DDD transparent transparent transparent;
      `;
  
      const arrowInner = document.createElement('div');
      arrowInner.style.cssText = `
        position: absolute;
        top: -12px;
        left: -10px;
        width: 0;
        height: 0;
        border-style: solid;
        border-width: 10px 10px 0 10px;
        border-color: #EEE transparent transparent transparent;
      `;
  
      arrow.appendChild(arrowInner);
      this.tooltip.appendChild(arrow);
    }
  
    show() {
      this.tooltip.style.display = 'block';
    }
  
    bindEvents() {
      document.addEventListener('click', () => {
        this.hide();
        localStorage.setItem(this.localStorageKey, 'true');
      }, { once: true });
    }
  
    hide() {
      this.tooltip.style.display = 'none';
    }
  }
  
  export default SimpleTooltip;
  