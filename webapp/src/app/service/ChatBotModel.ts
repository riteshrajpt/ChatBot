

export interface ChatBotModel{
    id:number;
    botname:string;
    botavatar:string;
    closematch: number,
    exactmatch: number,
    creationdate: string;
    creator: string;
    creatorid: null,
    botstatus: boolean,
    greeting: string;
    question:string;
    botresponse:string;
    botid:number;
    Q:number;

      conversationid:number,
      userquery: string,      
      botconfidence:number,
      username: string,
      timestamp: string,
      reviewed: boolean,
      userEmail: string,
      userContactNo:string,
      txtQuery:string,
      signalRmsg:string,
      
      qid:any,
      qlist:string,
      
}