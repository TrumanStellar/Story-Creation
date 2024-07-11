
import {
    Column,
    CreateDateColumn,
    Entity,
    PrimaryGeneratedColumn,
    UpdateDateColumn,
} from 'typeorm';

@Entity()
export class StellarTX {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ length: 128, default: 'PublishAsset' })
    txType: string;

    @Column({ length: 128, default: '' })
    storyId: string;

    @Column({ length: 128, default: '' })
    code: string;

    @Column({  default: 0 })
    num: number;

    @Column({ length: 128, default: '' })
    issuer: string;

    @Column({ length: 128 })
    txHash: string

    @CreateDateColumn()
    createTime: Date;

    @UpdateDateColumn()
    updateTime: Date;

    @Column({ default: false })
    isSuccessful: boolean;
}