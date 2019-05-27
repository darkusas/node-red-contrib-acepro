/**
 * Copyright ACEPRO-NET by Darius Aleškaitis @ MB ALDARNA (2019 04 02)
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 **/


//-------------- konstantos -----------------------------------------------------------------------------------------
const aceBUS_InitRetryDelay  = 10;          //  [s] mėginti vėl siųsti po šio laiko
const aceBUS_InitRetryTillTO  = 18;         //  bandymų skaičius po ko traktuojama klida: TimeOUT

const aceBUS_TxRetryDelay   = 2;            //  [s] mėginti vėl siųsti po šio laiko
const aceBUS_TxRetryTillTO  = 30;           //  bandymų skaičius po ko traktuojama klida: TimeOUT


const aceBUS_TxNotRelevant  = 30;           //  [s] po šio laiko jeigu ir nepavyko nustatyti, 
                                            //      bet ateina naujas paketas, tai naujas paketas užskaitomas kaip tikrasis
                                            
const aceBUS_RxWarnDelay    = 60;           //  [s] jeigu per tiek laiko negaunamas paketas bandom užklausti
const aceBUS_RxRetryTillTO  = 3;            //  bandymų skaičius po ko traktuojama klida: TimeOUT
 
const aceBUS_stNotifyPeriod = 1;            //  [s] kas tiek laiko tikrinti ar nereikia keisti statuso
const aceBUS_RxOKNotifyTime = 0.5;          //  [s] Tiek laiko rodomas statusas po sėkmingo gavimo


const aceBUS_ValRenTime     = 60;          //  [s] Jeigu duomenys nesikeičia tiesiog ateina tas pats duomuo
                                           //       tai nedažniau nei kad nurodyta siūsti į flow


const aceBUS_MainTimerPeriod= 100;          //  [ms] pagrindinio taimerio periodas
//----------------------------------------------------------------------------------------------------------------------------

//-------------- ryšio komandų konstantos ------------------------------------------------------------------------------------
const aceBUS_CMD_GetVal	    = 0xACE00040;   //  gauti reišmę
const aceBUS_CMD_SetVal	    = 0xACE00080;   //  nustatyti reikšmę
const aceBUS_CMD_OnChange   = 0xACE000C0;   //  pasikeitė reišmė
//----------------------------------------------------------------------------------------------------------------------------

//-------------- Objekto state rutinos ------------------------------------------------------------------------------------
const AcOS_Init             = 0;            //  Vadinasi laukiam inicializavimo
const AcOS_Ready            = 100;            //  Inicializacija baigta, gautas bent vienas paketas
const AcOS_WarnTO           = 200;            //  Negautas paketas per aceBUS_RxWarnDelay laiką
const AcOS_erTO             = 300;            //  Traktuojama klaida kadangi negautas paketas per (aceBUS_RxWarnDelay*aceBUS_RxRetryTillTO)
const AcOS_SetTx            = 400;            //  Vykdomas užsiuntimo procesas
const AcOS_erTxTO           = 500;            //  Traktuojama klaida nepavyko nustatyti per (aceBUS_TxRetryDelay*aceBUS_TxRetryTillTO)
const AcOS_Disabled         = 600;            //  

//----------------------------------------------------------------------------------------------------------------------------

// reikalignas modulis apdoroti UDP srautui
var udp = require('dgram');


//---------------   Pagalbinės funcijos --------------------------------------------------------------------------------------
// sukuriam lentelę
var   CRC32_acpTable = [];
const CRC32ether_POLY1 =  0x04c11db7;
const CRC32ether_WIDTH = 32;
const CRC32ether_TOPBIT = (1 << (CRC32ether_WIDTH - 1));

function crc32_acpTableCr()
{
    if (typeof Uint32Array !== 'undefined') CRC32_acpTable = new Uint32Array(256);

    let remainder = 0;
    for (let i = 0; i < 256; i++) {
      
 		remainder = i << (CRC32ether_WIDTH - 8);
		for (let bit = 8; bit > 0; --bit){
						
			if (remainder & CRC32ether_TOPBIT){
				remainder = (remainder << 1) ^ CRC32ether_POLY1;
			} else{
				remainder = (remainder << 1);
			}
		}
		CRC32_acpTable[i] = remainder;
		//console.log("\tCrcInd:",i,"\t 0x",CRC32_acpTable[i].toString(16)," \r\n");     
    }
}

//---- pagrindinis crc algoritmas --------------------------------------
function crc32_acepro(buf)
{
    if(CRC32_acpTable.length == 0) crc32_acpTableCr();
    
    let crc = new Uint32Array(1);
    crc[0] = 0xFFFFFFFF;
    
    for (let i = 0; i < buf.length; i++) {
        const byte = buf[i];
        crc[0] = CRC32_acpTable[(crc[0] ^ byte) & 0xff] ^ (crc[0] >>> 8);
    }
  
    return crc[0];
}

//----------------------------------------------------------------------------------------------------------------------------




//----------------------------------------------------------------------------------------------------------------------------
module.exports = function(RED)
{
    //Pagrindinė rutina
    function aceproNet(config)
    {
        // sukuriam node pagal config'ą
        RED.nodes.createNode(this, config);
        var node = this;  


        var name = config.name;
        var nameCrc = crc32_acepro(new Buffer(name,'ascii'));
        var BrCastAddr = config.BrAddress;
        var port = config.port;
        var IOIDobj_list = []; // saugojamos pagrindinės struktūros
        
   
        
        node.information = {
            "name": name,
            "nameCrc": "0x" + nameCrc.toString(16).toUpperCase(),
            "brAddress": BrCastAddr,
            "port": port
        }
        
        //console.log(config);
        
        // Nustato laiką po kurio reikia atlikti bet kokį veiksmą
        function SetActionNeededAfter(aceObj, delay){
           aceObj.nextTime = (Date.now() / 1000) + delay; 
        }
        // Nustato laiką po kurio reikės atnaujinti statusą
        function SetStUpdNeededAfter(aceObj, delay){
            if(delay===0){
                aceObj.nextStTime = 0; // išjungiam taimeri
            }else if(delay===-1){
                aceObj.nextStTime = 1; // forsuojam kad kuo greičiau būtų atvaizduota
            }else{
                aceObj.nextStTime = (Date.now() / 1000) + delay;   // nurodom kada turi atsinaujinti
            }
        }
 
        // tam kad tikrinti ar ne tuščias gavosi objektas
        function isEmptyObject(obj) {
          return !Object.keys(obj).length;
        }

        // callback apdorojimas
        function sendCB(CB, stateMsg, dataMsg){
            // tikrinam ar CB yra masyvas
            if( Object.prototype.toString.call( CB ) === '[object Array]' ) {
                let CBlstLen = CB.length;
                let t_stateMsg = null;
                let t_dataMsg = null;
                for (var i = 0; i < CBlstLen; i++) {
                    
                    
                    // 2019 05 23
                    
                    //----   Kad nesiųstų referencų   V1  ----
                   t_stateMsg = JSON.parse(JSON.stringify(stateMsg));
                   t_dataMsg = JSON.parse(JSON.stringify(dataMsg));
                    
                    
                    // Deja http://jsben.ch/ks8c9 kitas variatas nors ir geresnis bet neveikia
                    
                    CB[i](t_stateMsg, t_dataMsg);
                }                
            }else{
                CB(stateMsg, dataMsg);
            }
        }
 
            // statusų pateikimo templatai
                        // shape ->  ring , dot
                        // fill  ->  red  , green , yellow , blue , grey 
        var NotifyTempl = {
            Inicializ   : {fill:"yellow",   shape:"ring",   text:"Initializing ..."},
            GautasPak   : {fill:"green",    shape:"dot",    text: ""},
            LaukiamPak  : {fill:"grey",     shape:"dot",    text: ""},
            WarnTO      : {fill:"yellow",   shape:"ring",   text: "Waiting..."},
            errTO       : {fill:"red",      shape:"ring",   text: "Time OUT"},
            Err         : {fill:"red",      shape:"dot",    text: ""},
            SetPrg      : {fill:"blue",     shape:"dot",    text: "Writing..."},
            ErrSet      : {fill:"red",      shape:"ring",   text: "TimeOUT"},
            ErrNan      : {fill:"red",      shape:"dot",    text:"Sorry, numbers only!"},
            ErrReadOnly : {fill:"red",      shape:"dot",    text:"Sorry, read only!"},
            ErrObjNotF  : {fill:"red",      shape:"dot",    text:"ERROR, aceObj Not Found!"}
        };

        
        
        
        
        //statusų atnaujinimo funkcija 2019 04 06
        function renewStatus(AceObj, prCB){
            
                var stateMsg = {}; 
                var currNotfSt = -1;
                let dabar = (Date.now() / 1000);
                
                var NewRX_Event = ((dabar - AceObj.RxTime) > aceBUS_RxOKNotifyTime)?false:true;
                
                SetStUpdNeededAfter(AceObj, aceBUS_RxOKNotifyTime);
                
                if(NewRX_Event && (AceObj.IOIDState===0)){
                    stateMsg = NotifyTempl.GautasPak;
                    stateMsg.text = parseFloat(AceObj.ActualVAL).toFixed(3); 
                    AceObj.LastNotfSt = AcOS_Ready + 1;
                   // aktyvuojam pagrindinius callback'us
                   if(prCB==null) prCB = AceObj.CB;
                   // aktyvuojam callback'us
                   sendCB(prCB, stateMsg, null);  
                   return;
                }
                
                currNotfSt = AceObj.St;
  
                // identifikuojam koks statusas turi būti, bei ar reikia pateikti duomenis ar state'ą
                switch(AceObj.St){
                    case AcOS_Init:
                            stateMsg = NotifyTempl.Inicializ;
                    break;
                    case AcOS_Ready:
                            if(AceObj.IOIDState===0){
                                
                                stateMsg = NotifyTempl.LaukiamPak;
                                SetStUpdNeededAfter(AceObj,0);
                                currNotfSt +=2;
                                stateMsg.text = parseFloat(AceObj.ActualVAL).toFixed(3);                                
                                
                            }else{
                                //reikia apdoroti gaunamas klaidas ir pagal tai pakesiti statusą
  
                                switch(AceObj.IOIDState){
                                    
                                    case -1:        // IO_Fun_IOID_DISABLED
                                                stateMsg = NotifyTempl.LaukiamPak;
                                                stateMsg.text = "Disabled";
                                                currNotfSt +=3;
                                    break;
                                    
                                    case -300:      // IO_Fun_IO_NOT_FOUND
                                                stateMsg = NotifyTempl.Err;
                                                stateMsg.text = "Not found";
                                                currNotfSt +=4;
                                    break;
                                    
                                    case -3000:     // IO_Fun_NotReadyYet
                                                stateMsg = NotifyTempl.Err;
                                                stateMsg.text = "Not ready";
                                                currNotfSt +=5;
                                    break;
                                    
                                    case -9999:     // IO_Fun_FATAL_ERROR
                                                stateMsg = NotifyTempl.Err;
                                                stateMsg.text = "FATAL ERROR";
                                                currNotfSt +=6;
                                    break;
                                    
                                    default:        // Visos kitos klaidos
                                                stateMsg = NotifyTempl.Err;
                                                stateMsg.text = "IO ERROR";
                                                currNotfSt +=7;
                                }

                            }  
                    break;
                    case AcOS_WarnTO:
                        stateMsg = NotifyTempl.WarnTO;
                    break;
                    case AcOS_erTO:
                        stateMsg = NotifyTempl.errTO;
                    break;
                    case AcOS_SetTx:
                        stateMsg = NotifyTempl.SetPrg;
                        stateMsg.text = "Writing...->" + parseFloat(AceObj.TxVal).toFixed(3); 
                    break;
                    case AcOS_erTxTO: 
                        stateMsg = NotifyTempl.ErrSet;
                    break;
                    case AcOS_Disabled: 
                        stateMsg = NotifyTempl.LaukiamPak;
                        stateMsg.text = "Disabled";
                        currNotfSt = -1; // forsuojam pranešimą
                    break;                    
                    
                }
                
               
                // jeigu nepasikeitė statusas, nėra reikalo jo atnaujinti, išskyrus gautas arba siunčiamas paketas būtų
                if(
                    (
                    (AceObj.LastNotfSt === currNotfSt)  && 
                    (currNotfSt !== AcOS_Ready+2)       && 
                    (currNotfSt !== AcOS_SetTx)
                    ) ||
                    (NewRX_Event && (currNotfSt !== AcOS_Ready+2))||
                    ((AceObj.LastNotfSt === currNotfSt) && (AceObj.IOIDState !== 0) )
                 )
                 {
                    return;
                }
                
                if(currNotfSt !== -1) AceObj.LastNotfSt = currNotfSt;
               // aktyvuojam pagrindinius callback'us
               if(prCB==null) prCB = AceObj.CB;
               
               // aktyvuojam callback'us
               sendCB(prCB, stateMsg, null);                
            
        }
        
        
        
        
        // paruošiam atsakymą į NODE'us ------------------------------------
        function prepStandData(AceObj, prCB){
                var dataValMsg = {};
                var dataStMsg = {};
                var dataMsg = [];    
                var notifyMsgTxt = "";
                var dabar = (Date.now() / 1000);
                var forceStateUpd = ((dabar-AceObj.LastValRenTime) > aceBUS_ValRenTime) || (AceObj.LastSt === AcOS_Disabled) ;
                
                // identifikuojam koks statusas turi būti, bei ar reikia pateikti duomenis ar state'ą
                switch(AceObj.St){
                    case AcOS_Init:
                            notifyMsgTxt = "Initializing";
                    break;
                    case AcOS_Ready:
                        
                            if(AceObj.IOIDState===0){
                                // tikrinam ar nepasikeitė reikšmė, jeigu pasikeitė tai siunčiam toliau
                                if((AceObj.LastVAL !== AceObj.ActualVAL) || forceStateUpd){
                                    AceObj.CntValCh++;
                                    dataValMsg = {payload: AceObj.ActualVAL, topic:AceObj.topic, host:AceObj.dstName, IOID:AceObj.ioid,  IOIDstate: AceObj.IOIDState};
                                    AceObj.LastVAL = AceObj.ActualVAL;
                                }
 
                                notifyMsgTxt = "Valid";
                          
                            }else{
                                //reikia apdoroti gaunamas klaidas ir pagal tai pakesiti statusą
                                    
                                switch(AceObj.IOIDState){
                                    
                                    case -1:        // IO_Fun_IOID_DISABLED
                                                notifyMsgTxt = "Disabled";
                                    break;
                                    
                                    case -300:      // IO_Fun_IO_NOT_FOUND
                                                notifyMsgTxt = "Not found";
                                                
                                    break;
                                    
                                    case -3000:     // IO_Fun_NotReadyYet
                                                notifyMsgTxt = "Not ready";
                                    break;
                                    
                                    case -9999:     // IO_Fun_FATAL_ERROR
                                                notifyMsgTxt = "FATAL ERROR";
                                    break;
                                    
                                    default:        // Visos kitos klaidos
                                                notifyMsgTxt = "IO ERROR";
                                }
                                
                                    
                            }  
                    break;
                    case AcOS_WarnTO:
                        notifyMsgTxt = "Valid";
                       // jeigu forsuotas atnaujinimas tai siunčiam ir reikšmę
                        if(forceStateUpd){
                            dataValMsg = {payload: AceObj.ActualVAL, topic:AceObj.topic, host:AceObj.dstName, IOID:AceObj.ioid,  IOIDstate: AceObj.IOIDState};
                        }
                        
                    break;
                    case AcOS_erTO:
                        notifyMsgTxt = "Time OUT onRX";
                    break;
                    case AcOS_SetTx:
                        notifyMsgTxt = "Valid";
                    break;
                    case AcOS_erTxTO: 
                        notifyMsgTxt = "Time OUT onTX";
                    break;
                     case AcOS_Disabled: 
                        notifyMsgTxt = "Disabled";
                    break;                   
                }
                
                
                 // tikrinam ar nepasikeitęs statusas, jeigu pasikeitęs tai čiunčiam toliau
                if((AceObj.LastNotifyTxt !== notifyMsgTxt) || forceStateUpd ){
                    dataStMsg = {payload: notifyMsgTxt, topic:AceObj.topic, Value:AceObj.ActualVAL, host:AceObj.dstName, IOID:AceObj.ioid, IOIDstate: AceObj.IOIDState};
                    AceObj.LastNotifyTxt = notifyMsgTxt;
                    AceObj.LastValRenTime = dabar;
                }    
                
                
                // tam kad bereikalo nesiųsti paketų
                if(isEmptyObject(dataValMsg) && isEmptyObject(dataStMsg)){
                    dataMsg = null;
                }else{
                    dataMsg = [
                                isEmptyObject(dataValMsg)?null:dataValMsg,
                                isEmptyObject(dataStMsg)?null:dataStMsg,
                             ];                    
                }

               // aktyvuojam pagrindinius callback'us
               if(prCB==null) prCB = AceObj.CB;

              SetStUpdNeededAfter(AceObj, -1);
              
              // nunrodom kad kuo greičiau atnaujintų
               sendCB(prCB, null, dataMsg);    
               
               AceObj.LastSt = AceObj.St;
        }
        
        
        
        // ---------------------------      Pagrindinė gautų paketų apdorojimo rutina      -------------------------
        function DataProcessing(RxPac, AceObj){
        
            var dabar = (Date.now() / 1000);

            if(RxPac!==null){
                // tikrinam ar tikrai paketas tas kurio ir laukiam
                if(RxPac.CMD===aceBUS_CMD_OnChange){
                    AceObj.IOIDState = RxPac.State;
                    if(RxPac.State===0){
                        AceObj.RxVal = RxPac.Val;                        
                    }

                    AceObj.CntRx++;
                    AceObj.RxTime = dabar;
                    
                    if(AceObj.St<AcOS_SetTx){
                        AceObj.ActualVAL = AceObj.RxVal;
                    }
                    
                }else{
                    // paketas ne tas, išeinam
                    return;
                }
            }
            
            if((AceObj.IOIDState===-1)&&(RxPac!==null)){
                AceObj.St = AcOS_Disabled;
            }
          
            switch(AceObj.St){
                
                case AcOS_Init:
                    // jeigu paketas vis dar neatėjo
                    if(RxPac===null){
                        // kartojam paketą. (kadangi paketas null = imti iš cache'o)
                        netwSend(AceObj, null);
                        AceObj.cntRetry++;
                        if(AceObj.cntRetry>aceBUS_InitRetryTillTO){
                            AceObj.St = AcOS_erTO;
                            AceObj.cntTO = 1;
                        }
                        // uždedam naują timeout'ą
                        SetActionNeededAfter(AceObj, aceBUS_InitRetryDelay);
                        break;
                    }
                    AceObj.St = AcOS_Ready;
                    AceObj.cntRetry = 0;

                case AcOS_Ready:
                    SetActionNeededAfter(AceObj, aceBUS_RxWarnDelay);   
                    
                    AceObj.St = AcOS_WarnTO;
                    AceObj.cntWarnTO++;
                    AceObj.cntRetry = 1;
                    netwSend(
                            AceObj, 
                            {
                                CMD: aceBUS_CMD_GetVal,
                                Src: nameCrc,
                                Dst: AceObj.dstCRC,
                                State: 0,
                                IOID: AceObj.ioid,
                                val: 0.0                    
                            }
                    );
                break;             
                
                case AcOS_WarnTO:
                    SetActionNeededAfter(AceObj, aceBUS_RxWarnDelay);
                    
                    if(RxPac!==null){
                        AceObj.cntRetry = 0;
                        AceObj.St = AcOS_Ready;
                        break;
                    }
                   
                    netwSend(AceObj, null);
                    AceObj.cntRetry++;
                    if(AceObj.cntRetry>aceBUS_RxRetryTillTO){
                        AceObj.St = AcOS_erTO;
                        AceObj.cntTO++;
                    }
                
                break;               
                
                case AcOS_erTO:
                     SetActionNeededAfter(AceObj, aceBUS_RxWarnDelay);
                     
                    if(RxPac!==null){
                        AceObj.cntRetry = 0;
                        AceObj.St = AcOS_Ready;
                        break;
                    }
                    
                    netwSend(AceObj, null);
                    AceObj.cntRetry++;
                                  
                break;
                
                case AcOS_SetTx:
                    SetActionNeededAfter(AceObj, aceBUS_TxRetryDelay);
                    
                    if(RxPac!==null){
                        AceObj.cntRetry = 0;
                        if(AceObj.RxVal==AceObj.TxVal){
                            AceObj.ActualVAL = AceObj.TxVal;
                            AceObj.CntTx++;
                            AceObj.St = AcOS_Ready;
                            break;                            
                        }else{
                            let dabar = (Date.now() / 1000);
                            if((dabar - AceObj.TxCMDTime) > aceBUS_TxNotRelevant){
                                AceObj.ActualVAL = AceObj.RxVal;
                                AceObj.St = AcOS_Ready;
                                break;    
                            }
                            
                        }
                    }
                   
                    netwSend(AceObj, null);
                    AceObj.cntRetry++;
                    if(AceObj.cntRetry>aceBUS_TxRetryTillTO){
                        AceObj.St = AcOS_erTxTO;
                        AceObj.cntTO++;
                    }                    
                    
                    
                break;                
                 
                case AcOS_erTxTO:
                     SetActionNeededAfter(AceObj, aceBUS_RxWarnDelay);
                     
                    if(RxPac!==null){
                        AceObj.cntRetry = 0;
                        AceObj.St = AcOS_Ready;
                        break;
                    }
                    
                    AceObj.cntRetry++; 
                    AceObj.St = AcOS_erTO;
                    netwSend(
                            AceObj, 
                            {
                                CMD: aceBUS_CMD_GetVal,
                                Src: nameCrc,
                                Dst: AceObj.dstCRC,
                                State: 0,
                                IOID: AceObj.ioid,
                                val: 0.0                    
                            }
                    );
                                       
                break;
                case AcOS_Disabled:
                     SetActionNeededAfter(AceObj, aceBUS_RxWarnDelay);  
                     
                     if((RxPac!==null) && (AceObj.IOIDState!==-1)){
                         
                        AceObj.cntRetry = 0;
                        AceObj.St = AcOS_Ready;
                        break;
                    }
                    
                    AceObj.cntRetry++; 
                    AceObj.St = AcOS_Disabled;
                    netwSend(
                            AceObj, 
                            {
                                CMD: aceBUS_CMD_GetVal,
                                Src: nameCrc,
                                Dst: AceObj.dstCRC,
                                State: 0,
                                IOID: AceObj.ioid,
                                val: 0.0                    
                            }
                    );                    
                     
                break;
            }
            
  
            prepStandData(AceObj, null);
        
        }
        //----------------------------------------------------------------------------------------------------------
        
        
        // inicializuojam IPv4/UDP RX apdorojimą
        var srv = udp.createSocket('udp4');
        
        
        srv.on('error', (err) => {
           // console.log(`ACEPRO-NET UDP server error:\n${err.stack}`);
            //node.error("ACEPRO-NET UDP server error:", err);
            node.error(`ACEPRO-NET UDP server error:\n${err.stack}`);
            clearInterval(CheckIfTimeForProcc);
            srv.close();
            IOIDobj_list.splice(0,IOIDobj_list.length);
            IOIDobj_list.length = 0;   
            IOIDobj_list = [];  
        });
        
        // bindinam portą ir IP
        srv.bind(port, BrCastAddr, function() {
            srv.setBroadcast(true); // nurodom kad tai yra Broadcast paketai
        });
        
        // nurodom kad laukiam duomenų
        srv.on('listening', function () {
            var address = srv.address();
            console.log('ACEPRO-NET UDP listening on ' + address.address + ":" + address.port);
        });
        
       // registruojam gavimo įvykį  ------------------  -------------------
       srv.on('message', function (message, remote) {
            
            var RxPak = {
              CMD:      message.readUInt32BE(0), //.toString(16),
              SRC:      message.readUInt32BE(4), //.toString(16),
              DST:      message.readUInt32BE(8), //.toString(16),      
              State:    message.readInt32BE(12),       
              IOID:     message.readUInt32BE(16), 
              Val:      message.readDoubleBE(20)
            };
            
            // pirmiausia sugeneruojam raktą
            let key = RxPak.SRC.toString(16).toUpperCase() +"_"+ RxPak.IOID;
            
            // Tikrinam ar mus domina šis paketas
            if(IOIDobj_list[key] !== undefined){ 
                // Jeigu paketas domina tai siunčiam į apdorojimą
                DataProcessing(RxPak, IOIDobj_list[key]);
            }

       });
        
        
        // kai NODE yra uždaroma arba restartuojama, reikia stabdyti taimerius t.t.
        this.on("close", function() {
            clearInterval(CheckIfTimeForProcc);
            srv.close();
            IOIDobj_list.splice(0,IOIDobj_list.length);
            IOIDobj_list.length = 0;   
            IOIDobj_list = [];            
        });

  
        // naujo paketo siuntimo formavimas
        function netwSend(aceObj,txPack) {
            
            // jeigu paketas nenurodytas tada vadinasi reikia siutimą vykdyti iš cache
            if(txPack===null){
                txPack = aceObj.TxCache;
             //   console.log("ACEPRO-NET UDP Sent from Cache.");
            }else{
                aceObj.TxCache = txPack;
             //   console.log("ACEPRO-NET UDP Sent. No Cache used.");
            }
            
            const TxBuf = Buffer.allocUnsafe(28);
            TxBuf.writeUInt32BE(txPack.CMD, 0);
            TxBuf.writeUInt32BE(txPack.Src, 4);
            TxBuf.writeUInt32BE(txPack.Dst, 8);
            TxBuf.writeInt32BE(txPack.State, 12);
            TxBuf.writeUInt32BE(txPack.IOID, 16);
            TxBuf.writeDoubleBE(txPack.val, 20);
            srv.send(TxBuf, 0, TxBuf.length, port, BrCastAddr, function() {
              //  console.log("ACEPRO-NET UDP Sent '" + JSON.stringify(txPack) + "'");
            });         
           
        }
        

       // inicijuojam periodinį timeout tikrinimą 
       var CheckIfTimeForProcc = setInterval(function() {
            let dabar = (Date.now() / 1000);
            
            for (var k in IOIDobj_list){
                
                // tikrinam ar nesuėjo koks nors timeout'as
                if(IOIDobj_list[k].nextTime < dabar){
                   // console.log("CheckIfTimeForProcc: " + IOIDobj_list[k].dstName  + ":" + IOIDobj_list[k].ioid  + " | St:" + IOIDobj_list[k].St);
                    DataProcessing(null, IOIDobj_list[k]);
                }
                
                // tikrinam ar nėra reikalo atnaujinti statusus
                if ((IOIDobj_list[k].nextStTime !== 0)&&(IOIDobj_list[k].nextStTime < dabar)){
                    renewStatus(IOIDobj_list[k], null);
                }
            }

        }, aceBUS_MainTimerPeriod);
                
        
        
        // Funkcija kurios pagalba  registruojami IOID node'ai  --------------------------------------------------------
        node.RegisterIOID = function(IOIDobj, nCallBack){
            
            // sugeneruojam CRC32 kuris bus naudojamas raktui bei paketų atpažinimui
            let dstCRC = crc32_acepro(new Buffer(IOIDobj.host,'ascii'));
            // generuojam raktą
            let key = dstCRC.toString(16).toUpperCase() +"_"+ IOIDobj.IOID;
            // paruošiam topic'ą
            let topic = IOIDobj.host + "_" + IOIDobj.IOID;
            
            
            
            // Jeigu tokio IOID dar nėra formuojam naują objektą
            if(IOIDobj_list[key] === undefined){
                
                IOIDobj_list[key] = {
                    
                    topic: topic,           // topic        +: globalus identifikatorius
                    
                    ioid: parseInt(IOIDobj.IOID),     // IOID         +: adresas acepro modulioko viduje
                    dstName: IOIDobj.host,  // dstName      +: moduliuko host adresas, IPv4 tinkle identifikatorius
                    dstCRC: dstCRC,         // dstCRC       +: moduliuko host CRC32, greitam identifikavimui
                    //RO: IOIDobj.ReadOnly==='true'?true:false,   // RO           : jeigu TRUE vadinasi galima tik nuskaityti
                    IOIDState: -996699,       // IOIDState    +: paskutinis gautas statusas iš moduliuko                  
                    
                    ActualVAL: 0.0,         // ActualVAL    +: priimta aktuali reikšmė
                    LastVAL: 0.0,           // LastVAL      : paskutinė reišmė kuri buvo priduota vartotojui
                    LastValRenTime: 0,      // LastValRenTime : paskutinis kartas kada buvo į flow nusiūsti duomenys
  
                    
                    RxVal: 0.0,             // RxVal        +: paskutinė gauta reišmė
                    RxTime: 0,              // RxCMDTime    +: laikas kada paskutinį kartą buvo gauta RX
                    CntRx: 0,               // CntRx        +: viso RX paketų gauta
       
                    
                    TxVal: 0.0,             // TxVal        : paskutinė užstatyta reišmė
                    TxCMDTime: 0,           // TxCMDTime    : laikas kada užstatyta nauja reikšmė
                    CntTx: 0,               // CntTx        : išsiuntimų skaičius
                    
                    CntValCh: 0,            // CntValCh     : viso reikšmės pasikeitumų užregistruota
                    
                    CB: [],                 // CB           : CallBack masyvas, visi užregistruoti callbackai
                    
                    St: AcOS_Init,          // St           : Esamas objekto statusas      
                    LastSt: -1,             // LastSt       : Esamas objekto buvęs statusas 
                    
                    TxCache: {},            // TxCache      : naudojam Tx cache'avimui
                
                    cntTO:0,                // cntTO        : visų timeout'ų bendras skaičius
                    cntWarnTO:0,            // cntWarnTO    : jeigu nesulaukiama laiku paketo, bet tai tik pavienis paketas
                    cntRetry:0,             // cntRetry     : skaičiuojam bandymų skaičių
                    nextTime:0,             // nextTime     : tai laikas po ko reikia kažką daryti 


                    NotifyTime: 0,          // NotifyTime   : paskutinio statuso atnaujinimo laikas
                    LastNotifyTxt:"",       // LastNotifyTxt: paskutinis statuso tekstas
  
                    LastNotfSt: -1,
                    nextStTime:0,           // nextStTime   : tai laikas po kurio reikia atnaujinti statusą
                    
                    NotifyGotData: 0    // NotifyGotData: kai gaunamas paketas ir pranešama tai uždedama true, jeigu
                    
                };
                
                // jeigu tai naujas objektas tuomet reikia iniciuoti atnaujinimą iš moduliuko
                netwSend( 
                        IOIDobj_list[key], 
                        {
                            CMD: aceBUS_CMD_GetVal,
                            Src: nameCrc,
                            Dst: dstCRC,
                            State: 0,
                            IOID: IOIDobj.IOID,
                            val: 0.0                    
                        }
                );
                
                // nurodom timeout'ą po ko reikia atlikti pakartotiną siuntimą
                SetActionNeededAfter(IOIDobj_list[key], aceBUS_InitRetryDelay);
                
            }else{
                // vadinasi toks objektas jau yra
                // reikia užsiųsti iškarto paskutinę žinomą reišmę
                prepStandData(IOIDobj_list[key], nCallBack);
                renewStatus(IOIDobj_list[key], nCallBack)
            }
            
            // registruojam callback'ą
            IOIDobj_list[key].CB.push(nCallBack);
        }
        
         // Išregistruojam nenaudojamą node'ą  --------------------------------------------------------
        node.UnRegisterIOID = function(IOIDobj, nCallBack){
            // sugeneruojam CRC32 kuris bus naudojamas raktui bei paketų atpažinimui
            let dstCRC = crc32_acepro(new Buffer(IOIDobj.host,'ascii'));
            // generuojam raktą
            let key = dstCRC.toString(16).toUpperCase() +"_"+ IOIDobj.IOID;
            // surandam objektą
            if(IOIDobj_list[key] !== undefined){
                let CB = IOIDobj_list[key].CB;
                let i = CB.indexOf(nCallBack);
                //console.log("UnRegisterIOID key:"+ key + " index:" + i);
                
                // sunaikinam callback'ą
                if (i > -1) CB.splice(i, 1);
            
                // ištrinam ir visą objektą jeigu daugiau nebėra jame CallBack'ų
               if(CB.length===0) delete IOIDobj_list[key];
            }
        }  
        
        
        // -----------  GAUNAM DUOMENIS IŠ KITO NODE'o -------------------------------------------
        node.send = function(sender, data, callback) {

        //    console.log(sender);
                
            // tikrinam ar reikšmė yra skaičius
            if(isNaN(data.payload)){
                 callback(false, {payload: NotifyTempl.ErrNan});
                return;              
            }
            
            // sugeneruojam CRC32 kuris bus naudojamas raktui 
            let dstCRC = crc32_acepro(new Buffer(sender.host,'ascii'));
            // generuojam raktą
            let key = dstCRC.toString(16).toUpperCase() +"_"+ sender.IOID;

            // Surandam objektą
            if(IOIDobj_list[key] !== undefined){
                let AceObj = IOIDobj_list[key];
                
                //console.log(AceObj);
                
                // tikrinam ar į šį kintamajį galima įrašinėti
                /*
                if(AceObj.RO){
                    callback(false, {payload: NotifyTempl.ErrReadOnly});
                    return;
                }                
                */
                
                // jeigu yra Disablintas vadinasi įrašinėti negalima
                if(AceObj.IOIDState===-1) return;
                
                AceObj.St = AcOS_SetTx;
                AceObj.TxVal = data.payload
                AceObj.TxCMDTime = (Date.now() / 1000);
                AceObj.cntRetry = 0;
                
                // formuojam paketą ir siunčiam
                netwSend( 
                        AceObj, 
                        {
                            CMD: aceBUS_CMD_SetVal,
                            Src: nameCrc,
                            Dst: dstCRC,
                            State: 0,
                            IOID: AceObj.ioid,
                            val: data.payload                    
                        }
                );               
                
                // nurodom timeout'ą po ko reikia patikrinti ar sėkmingai įrašė
                SetActionNeededAfter(AceObj, aceBUS_TxRetryDelay);
                
                // atnaujinam informaciją visiems
                prepStandData(AceObj, null);
            }else{
                // nepavyko rasti objekto
                callback(false, {payload: NotifyTempl.ErrObjNotF});
                return;
            }

        };        
        
    }
    
    
    //Add the node
    RED.nodes.registerType("aceproNet", aceproNet);
}