import { AfterViewInit, Component, ElementRef, HostListener, OnDestroy, ViewChild } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { RealtimeChatComponent } from '../realtime-chat/realtime-chat.component';
import { ProjectInquiry, RealtimeChatService, newRequestId } from '../Shared/realtime-chat.service';

@Component({
  selector: 'app-chat-box',
  templateUrl: './chat-box.component.html',
  styleUrls: ['./chat-box.component.css']
})
export class ChatBoxComponent implements AfterViewInit, OnDestroy {
  @ViewChild(RealtimeChatComponent) assistant?: RealtimeChatComponent;
  @ViewChild('privacyClose') privacyClose?: ElementRef<HTMLButtonElement>;
  menuOpen = false;
  scrolled = false;
  selectedService = 0;
  activeDemo = 0;
  openFaq = 0;
  privacyOpen = false;
  sending = false;
  inquiryError = '';
  inquiryReference = '';
  heroTransform = '';
  year = new Date().getFullYear();
  private observer?: IntersectionObserver;
  private inquiryId = newRequestId();
  private submittedBrief = '';
  private privacyPreviousFocus?: HTMLElement;

  readonly services = [
    { number: '01', name: 'Product engineering', short: 'Software that moves you forward.', icon: 'code', description: 'Thoughtful websites, powerful applications and custom software. Built around the people who use them.', tags: ['Web applications', 'Custom software', 'API development'], detail: 'From a fresh idea to a better everyday experience.', body: 'We connect product thinking, considered design and practical engineering to turn complex requirements into software that makes sense.' },
    { number: '02', name: 'AI & automation', short: 'Less busywork. More possibility.', icon: 'spark', description: 'Put intelligence to work in the workflows that matter. Make space for your team to focus on what comes next.', tags: ['AI assistants', 'Workflow automation', 'Intelligent tools'], detail: 'Intelligence with a practical purpose.', body: 'Start with a real business problem. We help shape focused AI and automation solutions around your processes, your data and your people.' },
    { number: '03', name: 'Cloud engineering', short: 'A stronger foundation for what’s next.', icon: 'cloud', description: 'Cloud architecture and delivery that help your applications evolve, from the first deployment to the next chapter.', tags: ['Cloud architecture', 'DevOps', 'Application modernisation'], detail: 'Build a foundation that can grow with you.', body: 'Connect your application architecture, deployment workflow and operations with a clear plan for reliability, maintainability and future change.' },
    { number: '04', name: 'Connected experiences', short: 'Every interaction, in the moment.', icon: 'network', description: 'Connect systems, teams and customers with responsive APIs, live updates and real-time digital experiences.', tags: ['Real-time applications', 'System integrations', 'SignalR'], detail: 'Keep people and platforms in sync.', body: 'Bring your systems together through well-designed APIs and real-time communication. Make every update feel like part of one coherent experience.' }
  ];
  readonly process = [
    { number: '01', title: 'Understand', text: 'We start with your people, the problem and the possibilities. Good questions come before code.' },
    { number: '02', title: 'Shape', text: 'Turn the brief into a clear direction: user journeys, priorities and a practical technical plan.' },
    { number: '03', title: 'Build', text: 'Design, develop and test in focused steps. Keep the work visible and the feedback flowing.' },
    { number: '04', title: 'Evolve', text: 'Launch with purpose. Learn from the experience and plan the next meaningful improvement.' }
  ];
  readonly faqs = [
    { question: 'What can we build together?', answer: 'Company websites, custom web applications, AI-powered workflows, cloud platforms and real-time connected experiences. Share the problem you want to solve, and we can start shaping the right approach.' },
    { question: 'Can you improve an existing application?', answer: 'Yes. A project can begin with an existing application, an integration requirement or a workflow that needs improvement. Include your current technology and the changes you have in mind in your project brief.' },
    { question: 'Do I need a fully defined project brief?', answer: 'An initial idea is enough to start the conversation. Tell us who it is for, what you want to achieve and where you need help. Details can be refined as the direction becomes clearer.' },
    { question: 'How do I get started?', answer: 'Use the project form below to share your name, email, area of interest and a short description. Your enquiry is saved for the team to review. You can also explore our services with the Compileon assistant.' }
  ];
  readonly demoTabs = ['Product experiences', 'Intelligent workflows', 'Connected platforms'];
  readonly demoTitles = ['A clearer way to get things done.', 'Make the everyday work smarter.', 'Keep every moving part connected.'];
  readonly demoDescriptions = [
    'Purposeful interfaces that bring people, tasks and information together.',
    'Connect a manual process to a thoughtful, repeatable automated workflow.',
    'Bring live updates and connected systems into one shared experience.'
  ];
  readonly serviceOutcomes = [
    ['Product discovery and user journeys', 'Responsive websites and business applications', 'API design, integrations and data modelling', 'Testing, delivery and practical handover'],
    ['Workflow mapping and AI feasibility', 'Knowledge assistants and document workflows', 'Human review and validation checkpoints', 'Integration into existing business tools'],
    ['Architecture reviews and migration planning', 'Repeatable deployments and delivery pipelines', 'Monitoring and operational visibility', 'Maintainable application foundations'],
    ['Live support and customer communication', 'Real-time notifications and dashboards', 'APIs that connect business systems', 'Connection recovery and message persistence']
  ];
  readonly demoUseCases = [
    ['Customer portals', 'Internal tools', 'Workflow dashboards'],
    ['Document routing', 'Knowledge assistants', 'Approval workflows'],
    ['Customer support', 'Live operations', 'System integrations']
  ];
  readonly processDeliverables = ['A shared problem statement and priorities', 'A scoped roadmap and solution direction', 'Working increments and validation feedback', 'Deployment guidance and a plan for what comes next'];
  readonly engagementModels = [
    { title: 'Start something new.', text: 'Shape an early idea into a purposeful website, application or digital service.' },
    { title: 'Improve what exists.', text: 'Review an existing platform, simplify a workflow or modernise the experience.' },
    { title: 'Connect the pieces.', text: 'Bring your APIs, teams and systems together with a clearer flow of information.' }
  ];

  contactForm = new FormGroup({
    fullName: new FormControl('', [Validators.required, Validators.minLength(2), Validators.maxLength(120)]),
    email: new FormControl('', [Validators.required, Validators.email, Validators.maxLength(320)]),
    service: new FormControl('Product engineering', [Validators.required]),
    brief: new FormControl('', [Validators.required, Validators.minLength(20), Validators.maxLength(4000)]),
    consent: new FormControl(false, [Validators.requiredTrue]),
    website: new FormControl('')
  });

  constructor(private realtime: RealtimeChatService) { }

  ngAfterViewInit(): void {
    if (typeof IntersectionObserver !== 'undefined' && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      this.observer = new IntersectionObserver(entries => {
        entries.forEach(entry => { if (entry.isIntersecting) { entry.target.classList.add('revealed'); this.observer?.unobserve(entry.target); } });
      }, { threshold: 0.08 });
      document.querySelectorAll('.reveal').forEach(element => { element.classList.add('will-reveal'); this.observer?.observe(element); });
    }
  }
  @HostListener('window:scroll')
  onScroll(): void { this.scrolled = window.scrollY > 18; }
  @HostListener('document:keydown.escape')
  onEscape(): void { this.menuOpen = false; if (this.privacyOpen) { this.closePrivacy(); } }
  closeMenu(): void { this.menuOpen = false; }
  selectService(index: number): void { this.selectedService = index; }
  openAssistant(): void { this.assistant?.open(); this.menuOpen = false; }
  startProject(service?: string): void {
    if (service) { this.contactForm.patchValue({ service }); }
    this.menuOpen = false;
    document.getElementById('contact')?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    setTimeout(() => document.getElementById('project-name')?.focus({ preventScroll: true }), 400);
  }
  moveHero(event: MouseEvent): void {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { return; }
    const box = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const x = (event.clientX - box.left) / box.width - .5;
    const y = (event.clientY - box.top) / box.height - .5;
    this.heroTransform = 'rotateX(' + (-y * 5) + 'deg) rotateY(' + (x * 6) + 'deg)';
  }
  resetHero(): void { this.heroTransform = ''; }
  invalid(field: string): boolean {
    const control = this.contactForm.get(field);
    return !!control && control.invalid && (control.touched || control.dirty);
  }
  async submitInquiry(): Promise<void> {
    this.contactForm.markAllAsTouched();
    if (this.contactForm.invalid || this.sending) { return; }
    this.sending = true;
    this.inquiryError = '';
    const submittedBrief = JSON.stringify(this.contactForm.value);
    if (this.submittedBrief && this.submittedBrief !== submittedBrief) { this.inquiryId = newRequestId(); }
    this.submittedBrief = submittedBrief;
    try {
      const result = await this.realtime.submitInquiry(this.contactForm.value as ProjectInquiry, this.inquiryId);
      this.inquiryReference = result.reference;
    } catch { this.inquiryError = 'We couldn’t save your enquiry. Please check your connection and try again. Your details are still here.'; }
    finally { this.sending = false; }
  }
  anotherInquiry(): void {
    this.inquiryReference = '';
    this.inquiryId = newRequestId();
    this.submittedBrief = '';
    this.contactForm.reset({ fullName: '', email: '', service: 'Product engineering', brief: '', consent: false, website: '' });
  }
  showPrivacy(): void {
    this.privacyPreviousFocus = document.activeElement as HTMLElement;
    this.privacyOpen = true;
    setTimeout(() => this.privacyClose?.nativeElement.focus());
  }
  closePrivacy(): void { this.privacyOpen = false; this.privacyPreviousFocus?.focus(); }
  trapPrivacy(event: Event): void { event.preventDefault(); this.privacyClose?.nativeElement.focus(); }
  onTabKey(event: Event, kind: 'service' | 'demo'): void {
    const key = (event as KeyboardEvent).key;
    const count = kind === 'service' ? this.services.length : this.demoTabs.length;
    let index = kind === 'service' ? this.selectedService : this.activeDemo;
    if (key === 'Home') { index = 0; }
    else if (key === 'End') { index = count - 1; }
    else if (key === 'ArrowRight' || (kind === 'service' && key === 'ArrowDown')) { index = (index + 1) % count; }
    else if (key === 'ArrowLeft' || (kind === 'service' && key === 'ArrowUp')) { index = (index - 1 + count) % count; }
    else { return; }
    event.preventDefault();
    if (kind === 'service') { this.selectedService = index; } else { this.activeDemo = index; }
    document.getElementById(kind + '-tab-' + index)?.focus();
  }
  ngOnDestroy(): void { this.observer?.disconnect(); }
}
