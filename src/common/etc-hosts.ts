import { environment } from '../environment';
import { readFilePromise, writeFilePromise } from './utils';

const addressRegExStr='(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)';
const domainRegExStr='[a-zA-Z0-9][a-zA-Z0-9-]{1,61}[a-zA-Z0-9](?:\.[a-zA-Z0-9-]{2,})*';

const addressRegEx = new RegExp(addressRegExStr);
const addressValidationRegEx = new RegExp(`^${addressRegExStr}$`);

const domainRegEx = new RegExp(domainRegExStr);
const domainValidationRegEx = new RegExp(`^${domainRegExStr}$`);

function validateDomain(domain:string){
    if(domainValidationRegEx.test(domain)==false)
        throw new Error(`'domain' is not a valid dns name`);
}
function validateAddress(address:string){
    if(addressValidationRegEx.test(address)==false)
        throw new Error(`'address' must be a valid ip address`);
}

export interface EtcHostsContent{
    comments:string[];
    mappings:{[key:string]:string};
}

async function readHosts():Promise<EtcHostsContent>{
    const path = (environment.hostsPath as any)[process.platform];

    const data = await readFilePromise(path);

    const lines = data.split('\n').filter(p=>p.length>0);

    return {
        comments: lines.filter(p=>p.startsWith('#')),
        mappings: lines.filter(p=>!p.startsWith('#') && p.trim().length>0).map(line=>{
            const match = line.trim().match(new RegExp(`(${addressRegExStr})\\s+(${domainRegExStr})`));
            return {
                address:match?match[1]:'',
                domain:match?match[2]:''
            }
        }).reduce((acc, p)=>{
            acc[p.domain]=p.address;
            
            return acc;
        },{} as any)
    };
}

async function writeHosts(content:EtcHostsContent):Promise<void>{
    const path = (environment.hostsPath as any)[process.platform];

    await writeFilePromise(path,content.comments.join('\n')+'\n'+Object.keys(content.mappings).map(p=>`\t${content.mappings[p]}\t${p}`).join('\n'));
}

export class EtcHosts{
    
    constructor(private content:EtcHostsContent) {
        
    }

    public static async create():Promise<EtcHosts>{
        return new EtcHosts(await readHosts());
    }

    public async flush():Promise<void>{
        await writeHosts(this.content);
    }

    public address(domain:string){
        validateDomain(domain);

        return this.content.mappings[domain]||null;
    }

    public domains(address:string){
        validateAddress(address);
                        
        return Object.keys(this.content.mappings).filter(key=>this.content.mappings[key]==address);
    }

    public addMapping(domain:string, address:string){
        validateDomain(domain);
        validateAddress(address);
        
                
        if(!this.content.mappings[domain]){
            this.content.mappings[domain]=address;
        }
    }

    public removeMapping(domain:string, address:string){
        validateDomain(domain);
        validateAddress(address);
                        
        if(this.content.mappings[domain]==address){
            delete this.content.mappings[domain];
        }
    }

    public removeDomain(domain:string){
        validateDomain(domain);
                        
        if(this.content.mappings[domain]){
            delete this.content.mappings[domain];
        }
    }

    public removeAddress(address:string){
        validateAddress(address);
                        
        Object.keys(this.content.mappings).forEach(key=>{
            if(this.content.mappings[key]==address)
                delete this.content.mappings[key];
        });
    }
}