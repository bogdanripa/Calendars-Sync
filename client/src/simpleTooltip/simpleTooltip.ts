import './style.css';

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
        left: ${this.target.offsetLeft + this.target.offsetWidth / 2}px;
        top: -1000px;
      `;
  
      document.body.appendChild(this.tooltip);
      this.show();
      this.bindEvents();
  
      // Add arrow with border
      const arrow = document.createElement('div');
      arrow.className = 'arrow';
  
      const arrowInner = document.createElement('div');
      arrowInner.className = 'arrow-inner';
  
      arrow.appendChild(arrowInner);
      this.tooltip.appendChild(arrow);

      this.tooltip.style.top = `${this.target.offsetTop - 10 - this.tooltip.offsetHeight + this.offsetY}px`;
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
  