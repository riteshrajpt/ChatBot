import { Component, OnInit } from '@angular/core';
import { ChatbotService } from '../service/chatbot.service';
import * as XLSX from 'xlsx';
@Component({
  selector: 'app-chatbot-rpt',
  templateUrl: './chatbot-rpt.component.html',
  styleUrls: ['./chatbot-rpt.component.css']
})
export class ChatbotRptComponent implements OnInit {
  searchText: any;
  toggle = true;
  columns: { field: string; header: string; }[] = [];
  ChatRpt: string | undefined;
  ChatRptConversationID: any[]= [];
  ChatRptDetails: any[]=[];
  constructor(private ChatData: ChatbotService) { }

  ngOnInit(): void {
    this.getChatRpt();
    this.columns = [
      { field: 'conversationid', header: 'Conversation Id' },
      { field: 'timestamp', header: 'Date & Time' },
      { field: 'txtQuery', header: 'User Query' },
    ];
  }

  getChatRpt () {debugger
    this.ChatData.GetChatRpt().subscribe((resp) => {
      //var dataResponse = JSON.stringify(res)
      //this.ChatRpt = JSON.stringify(res);
      console.log(resp);
      this.ChatRptConversationID = resp;
    },
    (err)=>{
      console.log(err);
    }
    )
  }

  enableDisableRule(data:any) {debugger
    if(data.status == 'Ticket is Open'){
      data.status = 'Ticket is Closed';
      this.ChatData.UpdateChatTickets(data).subscribe((resp) => {
        //var dataResponse = JSON.stringify(res)
        //this.ChatRpt = JSON.stringify(res);
        console.log(resp);
        //this.ChatRptDetails = resp;
      },
      (err)=>{
        console.log(err);
      }
      )
    }
    else{
      data.status = 'Ticket is Open';
      this.ChatData.UpdateChatTickets(data).subscribe((resp) => {
        //var dataResponse = JSON.stringify(res)
        //this.ChatRpt = JSON.stringify(res);
        console.log(resp);
        //this.ChatRptDetails = resp;
      },
      (err)=>{
        console.log(err);
      }
      )
      
    }
    data.toggle = !data.toggle;
    data.status = data.toggle ? 'Ticket is Open' : 'Ticket is closed';
    
}

ExportChatList(data: any) {debugger
    
  //const obj = this.getLazyLoadingValues(this.event);
  //obj.pageSize = -1;
  this.ChatData.ChatDetails(data).subscribe((resp: any) => {
   
    this.ChatRptDetails = resp;
      /* generate worksheet */
      const ws: XLSX.WorkSheet = XLSX.utils.aoa_to_sheet(this.prep(this.ChatRptDetails));

      /* generate workbook and add the worksheet */
      const wb: XLSX.WorkBook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');

      /* save to file */
      // XLSX.writeFile(wb, 'Scheme-Report-' + this._dt.transform(this.FrmDt, 'dd-MMM-yyyy') + '-' +
      //   this._dt.transform(this.ToDt, 'dd-MMM-yyyy') + '.xlsx');
      XLSX.writeFile(wb, 'Chatting_details.xlsx');
    
  }, err => { });
}

prep(arr:any) {debugger    
  let out = [];
  const hdr = this.columns;
  const d = new Array();
  for (let i = 0; i < hdr.length; ++i) {
    Object.keys(hdr[i]).forEach(function (k, j) {
      if (k == 'header') {
        d[i] = hdr[i][k];
      }
    });
  }
  out[0] = d;

  const ignoreList = ['totalRows','CreatedBy','ProductId']; // these columns are not required in excel
  let l = 1;
  for (let i = 0; i < arr.length; ++i) {      
    if (!arr[i]) { continue; }
    if (Array.isArray(arr[i])) { out[i] = arr[i]; continue; }
    const o = new Array();
    let m = 0;
    Object.keys(arr[i]).forEach((k, j) => {
      if (!ignoreList.includes(k)) {
        o[+m] = arr[i][k];
        m++;
      }
    });
    out[l] = o;
    l++;
  }
  return out;
}
  ChatDetails (data:any) {debugger
    this.ChatData.ChatDetails(data).subscribe((resp) => {
      //var dataResponse = JSON.stringify(res)
      //this.ChatRpt = JSON.stringify(res);
      console.log(resp);
      this.ChatRptDetails = resp;
    },
    (err)=>{
      console.log(err);
    }
    )
  }

}
