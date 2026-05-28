import { Component } from '@angular/core';
import { NAME_APP_SHORT } from '../../../config/config';

@Component({
  selector: 'app-footer',
  standalone: true,
  imports: [],
  templateUrl: './footer.component.html',
  styleUrl: './footer.component.css'
})
export class FooterComponent {

  nombreApp = NAME_APP_SHORT;

}
