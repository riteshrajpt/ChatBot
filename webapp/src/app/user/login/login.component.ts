import { ToastrService } from 'ngx-toastr';
import { UserService } from '../../service/user.service';
import { Component, OnInit } from '@angular/core';
import { NgForm } from '@angular/forms';
import { Router } from '@angular/router';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styles: []
})
export class LoginComponent implements OnInit {
  formModel = {
    UserName: '',
    Password: ''
  }
  constructor(private service: UserService, private router: Router, private toastr: ToastrService) { }

  ngOnInit() {
    // if (localStorage.getItem('token') != null)
    //   this.router.navigateByUrl('/dashboard');
  }

  onSubmit(form: NgForm) {debugger
    if(form.value.Email == 'admin@holostik.com'){
      console.log("yhi toh data h:",form.value)
      this.service.login(form.value).subscribe(
        (res: any) => {
          localStorage.setItem('token', res.token);
          localStorage.setItem('login-user', JSON.stringify(res.user));
          this.router.navigateByUrl('/dashboard');
        },
        err => {
          if (err.status == 400)
            this.toastr.error('Incorrect Email.', 'Authentication failed.');
          else
            console.log(err);
        }
      );
    }
    else{
      this.toastr.error('Access Denied!', 'Authentication failed.');
    }
   
  }
}
