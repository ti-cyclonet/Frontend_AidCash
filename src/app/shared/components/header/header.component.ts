import { Component, EventEmitter, Input, Output } from '@angular/core';
import { DESCRIPTION_APP } from '../../../config/config';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.css']
})
export class HeaderComponent {
  private _isSidebarVisible: boolean = false;

  @Input() 
  set isSidebarVisible(value: boolean) {
    this._isSidebarVisible = value;
  }
  get isSidebarVisible(): boolean {
    return this._isSidebarVisible;
  }

  @Output() sidebarToggle = new EventEmitter<void>();
  nombreApp = DESCRIPTION_APP;

  onToggleSidebar(): void {
    this._isSidebarVisible = !this._isSidebarVisible;
    this.sidebarToggle.emit(); // Opcional: Notificar al componente padre sobre el cambio
  }
}

