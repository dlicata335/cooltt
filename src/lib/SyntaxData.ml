open CoolBasis.Bwd

type t =
  | Var of int
  | Global of Symbol.t
  | Let of t * t
  | Ann of t * tp
  | Zero
  | Suc of t
  | NatElim of ghost option * tp * t * t * t
  | Lam of t
  | Ap of t * t
  | Pair of t * t
  | Fst of t
  | Snd of t
  | Refl of t
  | IdElim of ghost option * tp * t * t
  | GoalRet of t
  | GoalProj of t
  | Coe of t * t * t * t
  | HCom of t * t * t * t * t
  | TpCode of t gtp
  | SubIn of t
  | SubOut of t
  | Dim0
  | Dim1
  | Cof of (t, t) Cof.cof_f
  | CofSplit of tp * t * t * t * t
  | CofAbort 
  | Prf

and tp = 
  | Tp of tp gtp
  | Univ : tp
  | El : t -> tp
  | GoalTp : string option * tp -> tp
  | TpDim : tp
  | TpCof : tp
  | TpPrf : t -> tp
  | Sub : tp * t * t -> tp

and _ gtp =
  | Nat : 'a gtp
  | Pi : 'a * 'a -> 'a gtp
  | Sg : 'a * 'a -> 'a gtp
  | Id : 'a * t * t -> 'a gtp


and ghost = string bwd * (tp * t) list

type env = tp list