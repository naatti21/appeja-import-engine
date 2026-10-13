/** Thirty synthetic PDF layouts with explicit positive and adversarial oracles. */
const good=(id,pages,ytd=42000,gross=3200,prev=38000)=>({id,pages,safe:true,values:{ytd,gross,previous:prev}});
const block=(id,pages,issue)=>({id,pages,safe:false,issue});
export const layoutCases=[
 good('01-baseline',[{}]),
 good('02-gross-variant',[{gross:'2 800,00'}],42000,2800),
 good('03-ytd-variant',[{ytd:'52 000,00'}],52000),
 good('04-previous-year-variant',[{previous:'27 000,00'}],42000,3200,27000),
 good('05-reversed-columns',[{reverse:true}]),
 good('06-identical-two-pages',[{},{ytd:'42 000,00'}]),
 good('07-identical-same-page',[{secondBlock:'42 000,00'}]),
 good('08-ytd-left-20',[{offsets:{ytd:-20}}]),
 good('09-ytd-right-20',[{offsets:{ytd:20}}]),
 good('10-gross-right-20',[{offsets:{gross:20}}]),
 good('11-previous-left-20',[{offsets:{previous:-20}}]),
 good('12-ytd-left-80',[{offsets:{ytd:-80}}]),
 good('13-unrelated-amount-above',[{noiseAbove:true}]),
 good('14-second-page-reversed',[{}, {reverse:true}]),
 good('15-identical-three-pages',[{},{},{}]),
 good('16-split-ytd-header',[{splitHeader:'ytd'}]),
 good('17-split-gross-header',[{splitHeader:'gross'}]),
 block('18-two-page-conflict',[{ytd:'42 000,00'},{ytd:'43 000,00'}],'conflict'),
 block('19-same-page-conflict',[{secondBlock:'43 000,00'}],'conflict'),
 block('20-missing-ytd',[{includeYtd:false}],'MISSING_TABLE_VALUE'),
 block('21-ambiguous-locale-number',[{ytd:'1,234'}],'INVALID_MONEY_CELL'),
 block('22-invalid-ytd',[{ytd:'forty'}],'INVALID_MONEY_CELL'),
 block('23-negative-gross',[{gross:'-3 200,00'}],'INVALID_MONEY_CELL'),
 block('24-surplus-money-cell',[{extraMoney:true}],'AMBIGUOUS_MONEY_COLUMN'),
 block('25-unanchored-money-row',[{unanchoredMoney:true}],'UNANCHORED_MONEY_ROW'),
 block('26-ytd-way-outside-column',[{offsets:{ytd:-180}}],'AMBIGUOUS_MONEY_COLUMN'),
 block('27-gross-way-outside-column',[{offsets:{gross:160}}],'AMBIGUOUS_MONEY_COLUMN'),
 block('28-duplicate-ytd-header',[{duplicateHeader:'ytd'}],'DUPLICATE_TABLE_COLUMN'),
 block('29-cropped-page',[{crop:true}],'PDF_BRIDGE_REJECT'),
 block('30-rotated-page',[{rotate:90}],'PDF_BRIDGE_REJECT')
];
if(layoutCases.length!==30)throw new Error('Expected exactly 30 layout cases');
