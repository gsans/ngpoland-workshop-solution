import { Component, ChangeDetectorRef, OnInit, OnDestroy } from '@angular/core';
import { onAuthUIStateChange, AuthState } from '@aws-amplify/ui-components';
import Auth from '@aws-amplify/auth';
import { DataStore, Predicates } from "@aws-amplify/datastore";
import { Chatty } from "../models";
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import * as moment from "moment";
import { Hub } from 'aws-amplify';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent implements OnInit, OnDestroy {
  user;
  unregister;
  moment = moment;
  messages: Array<Chatty>;
  public createForm: FormGroup;
  subscription;
  listener = undefined;
  offline = undefined;

  loadMessages() {
    DataStore.query<Chatty>(Chatty, Predicates.ALL)
      .then(messages => {
        this.messages = [...messages].sort((a, b) => -a.createdAt.localeCompare(b.createdAt));
      })
  }

  constructor(private fb: FormBuilder, private ref: ChangeDetectorRef) {
    Auth.currentAuthenticatedUser().then(console.log);
    this.createForm = this.fb.group({
      'message': ['', Validators.required],
    });
  }

  ngOnInit() {
    this.unregister = onAuthUIStateChange((state, user) => {
      if (state === AuthState.SignedIn) {
        this.user = user;
        this.ref.detectChanges();
      }
    })
    //listen to datastore
    console.log('Registering datastore hub');
    this.listener = Hub.listen('datastore', message => {
      const { event, data } = message.payload;
      console.log("DataStore event", event, data);
      if (event === 'networkStatus') {
        this.offline = !data.active;
      }
    })
    this.loadMessages();
    this.subscription = DataStore.observe<Chatty>(Chatty).subscribe(msg => {
      console.log(msg.model, msg.opType, msg.element);
      this.loadMessages();
    });
  }
  ngOnDestroy() {
    this.unregister();
    this.listener();
    if (!this.subscription) return;
    this.subscription.unsubscribe();
  }
  public onCreate(message: any) {
    if (message.message == "") return;

    DataStore.save(new Chatty({
      user: this.user.username,
      message: message.message,
      createdAt: new Date().toISOString()
    })).then(() => {
      console.log('message created!');
      this.createForm.reset();
      this.loadMessages();
    })
    .catch(e => {
      console.log('error creating message...', e);
    });
  }
  public async onDeleteAll() {
    await DataStore.delete<Chatty>(Chatty, Predicates.ALL)
      .then(() => this.loadMessages())
      .catch(e => {
        console.log('error deleting all messages...', e);
      });
  }
}